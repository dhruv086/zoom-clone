import os
import secrets
from datetime import timedelta, datetime, timezone as dt_timezone

import jwt
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from meetings.models import Meeting, Participant, User, ChatMessage
from meetings.serializers import MeetingSerializer, ParticipantSerializer, UserSerializer, ChatMessageSerializer


def has_host_access(meeting, supplied_token):
    return bool(supplied_token) and secrets.compare_digest(str(meeting.host_access_token), str(supplied_token))

class UserViewSet(viewsets.ModelViewSet):
    """
    Equivalent to an Express Router for /users CRUD.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer


class MeetingViewSet(viewsets.ModelViewSet):
    """
    Equivalent to an Express Router for /meetings CRUD and specific operations.
    """
    queryset = Meeting.objects.all().order_by('-created_at')
    serializer_class = MeetingSerializer

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        meeting = Meeting.objects.get(pk=response.data['id'])
        # This secret is returned only when the meeting is created. The client
        # stores it in sessionStorage and uses it for host-only actions.
        response.data['host_access_token'] = str(meeting.host_access_token)
        return response

    # GET /api/meetings/upcoming/
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        now = timezone.now()
        # Find scheduled meetings starting in the future
        upcoming_meetings = Meeting.objects.filter(
            scheduled_at__gte=now,
            is_active=True
        ).order_by('scheduled_at')
        serializer = self.get_serializer(upcoming_meetings, many=True)
        return Response(serializer.data)

    # GET /api/meetings/recent/
    @action(detail=False, methods=['get'])
    def recent(self, request):
        # Filter meetings created in the past 24 hours
        cutoff = timezone.now() - timedelta(hours=24)
        recent_meetings = Meeting.objects.filter(
            created_at__gte=cutoff
        ).order_by('-created_at')
        serializer = self.get_serializer(recent_meetings, many=True)
        return Response(serializer.data)

    # GET /api/meetings/validate/<mid>/
    @action(detail=False, methods=['get'], url_path='validate/(?P<mid>[^/.]+)')
    def validate_meeting(self, request, mid=None):
        try:
            # mid is the XXX-XXX-XXXX format
            meeting = Meeting.objects.get(meeting_id=mid, is_active=True)
            return Response({
                "valid": True,
                "id": str(meeting.id),
                "meeting_id": meeting.meeting_id,
                "title": meeting.title,
                "host_name": meeting.host.display_name
            })
        except Meeting.DoesNotExist:
            return Response({
                "valid": False,
                "error": "Meeting ID not found or meeting has ended"
            }, status=status.HTTP_404_NOT_FOUND)

    # POST /api/meetings/<id>/join/
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        meeting = self.get_object()
        display_name = request.data.get('display_name', 'Guest User')
        is_host = has_host_access(meeting, request.data.get('host_access_token'))
        is_video_on = request.data.get('is_video_on', True)
        is_audio_on = request.data.get('is_audio_on', True)

        # Mark any existing active participant with this display_name in this meeting as left first
        # to prevent duplicate active entities
        Participant.objects.filter(
            meeting=meeting,
            display_name=display_name,
            left_at__isnull=True
        ).update(left_at=timezone.now())

        # Create a new participant record
        participant = Participant.objects.create(
            meeting=meeting,
            display_name=display_name,
            is_host=is_host,
            is_video_on=is_video_on,
            is_audio_on=is_audio_on
        )
        
        serializer = ParticipantSerializer(participant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # POST /api/meetings/<id>/leave/
    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        meeting = self.get_object()
        display_name = request.data.get('display_name')
        
        if display_name:
            participants = Participant.objects.filter(
                meeting=meeting,
                display_name=display_name,
                left_at__isnull=True
            )
            for p in participants:
                p.left_at = timezone.now()
                p.save()
            
        return Response({"status": "left"}, status=status.HTTP_200_OK)

    # POST /api/meetings/<id>/end/
    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        meeting = self.get_object()
        participant_id = request.data.get('participant_id')
        is_host = has_host_access(meeting, request.data.get('host_access_token')) and Participant.objects.filter(
            id=participant_id, meeting=meeting, left_at__isnull=True, is_host=True
        ).exists()
        if not is_host:
            return Response({'detail': 'Only the host can end this meeting.'}, status=status.HTTP_403_FORBIDDEN)
        meeting.is_active = False
        meeting.save()
        
        # Mark all active participants as left
        Participant.objects.filter(meeting=meeting, left_at__isnull=True).update(left_at=timezone.now())
        
        return Response({"status": "ended"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def mute_all(self, request, pk=None):
        meeting = self.get_object()
        participant_id = request.data.get('participant_id')
        is_host = has_host_access(meeting, request.data.get('host_access_token')) and Participant.objects.filter(
            id=participant_id, meeting=meeting, left_at__isnull=True, is_host=True
        ).exists()
        if not is_host:
            return Response({'detail': 'Only the host can mute everyone.'}, status=status.HTTP_403_FORBIDDEN)
        queryset = Participant.objects.filter(meeting=meeting, left_at__isnull=True, is_host=False)
        queryset.update(is_audio_on=False)

        return Response({
            "status": "muted_all",
            "participants": ParticipantSerializer(queryset, many=True).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def livekit_token(self, request, pk=None):
        meeting = self.get_object()
        if not meeting.is_active:
            return Response({'detail': 'This meeting has ended.'}, status=status.HTTP_410_GONE)

        display_name = str(request.data.get('display_name', 'Guest User')).strip()[:100] or 'Guest User'
        participant_id = request.data.get('participant_id')
        participant = None
        if participant_id and str(participant_id).isdigit():
            participant = Participant.objects.filter(
                id=participant_id,
                meeting=meeting,
                left_at__isnull=True,
            ).first()

        # A direct room link can reach this endpoint without the pre-join page.
        # Create the participant here so it always has a stable LiveKit identity.
        if participant is None:
            participant = Participant.objects.create(
                meeting=meeting,
                display_name=display_name,
                is_host=has_host_access(meeting, request.data.get('host_access_token')),
                is_video_on=False,
                is_audio_on=False,
            )
        elif participant.display_name != display_name:
            participant.display_name = display_name
            participant.save(update_fields=['display_name'])

        room_name = str(meeting.meeting_id)
        user_name = participant.display_name
        api_key = os.getenv('LIVEKIT_API_KEY', 'devkey')
        api_secret = os.getenv('LIVEKIT_API_SECRET', 'secret')
        ws_url = os.getenv('LIVEKIT_WS_URL', 'ws://localhost:7880')

        now = datetime.now(dt_timezone.utc)
        payload = {
            'iss': api_key,
            # LiveKit identities must be unique within a room.  A database
            # participant id remains unique even when guests use the same name.
            'sub': str(participant.id),
            'iat': int(now.timestamp()),
            'exp': int((now + timedelta(hours=4)).timestamp()),
            'nbf': int(now.timestamp()),
            'name': user_name,
            'room': room_name,
            'video': {
                'room': room_name,
                'roomJoin': True,
                'canPublish': True,
                'canSubscribe': True,
                'canPublishData': True,
            },
        }
        if participant.is_host:
            payload['video']['roomAdmin'] = True

        token = jwt.encode(payload, api_secret, algorithm='HS256')

        return Response({
            'token': token,
            'room_name': room_name,
            'ws_url': ws_url,
            'display_name': user_name,
            'participant': ParticipantSerializer(participant).data,
        }, status=status.HTTP_200_OK)


class ParticipantViewSet(viewsets.ModelViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer

    @action(detail=True, methods=['post'])
    def toggle_audio(self, request, pk=None):
        participant = self.get_object()
        is_audio_on = request.data.get('is_audio_on')
        if is_audio_on is None:
            is_audio_on = not participant.is_audio_on
        participant.is_audio_on = is_audio_on
        participant.save()
        return Response(ParticipantSerializer(participant).data)

    @action(detail=True, methods=['post'])
    def toggle_video(self, request, pk=None):
        participant = self.get_object()
        is_video_on = request.data.get('is_video_on')
        if is_video_on is None:
            is_video_on = not participant.is_video_on
        participant.is_video_on = is_video_on
        participant.save()
        return Response(ParticipantSerializer(participant).data)

    @action(detail=True, methods=['post'])
    def kick(self, request, pk=None):
        participant = self.get_object()
        meeting = participant.meeting
        is_host = has_host_access(meeting, request.data.get('host_access_token'))
        if not is_host:
            return Response({'detail': 'Only the host can remove participants.'}, status=status.HTTP_403_FORBIDDEN)
        participant.left_at = timezone.now()
        participant.save()
        return Response(ParticipantSerializer(participant).data)


class ChatMessageViewSet(viewsets.ModelViewSet):
    queryset = ChatMessage.objects.all().order_by('sent_at')
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        queryset = self.queryset
        # Allows filtering messages by meeting UUID
        meeting_uuid = self.request.query_params.get('meeting_id')
        if meeting_uuid:
            queryset = queryset.filter(meeting_id=meeting_uuid)
        return queryset
