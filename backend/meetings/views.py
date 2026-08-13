from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from meetings.models import Meeting, Participant, User, ChatMessage
from meetings.serializers import MeetingSerializer, ParticipantSerializer, UserSerializer, ChatMessageSerializer

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
        is_host = request.data.get('is_host', False)
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
        
        if not display_name:
            return Response({"error": "display_name is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Find active participant matching name in this meeting
        participants = Participant.objects.filter(
            meeting=meeting,
            display_name=display_name,
            left_at__isnull=True
        )
        
        if not participants.exists():
            return Response({"error": "Active participant not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # Mark as left by setting left_at timestamp
        for p in participants:
            p.left_at = timezone.now()
            p.save()
            
        return Response({"status": "left"}, status=status.HTTP_200_OK)

    # POST /api/meetings/<id>/end/
    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        meeting = self.get_object()
        meeting.is_active = False
        meeting.save()
        
        # Mark all active participants as left
        Participant.objects.filter(meeting=meeting, left_at__isnull=True).update(left_at=timezone.now())
        
        return Response({"status": "ended"}, status=status.HTTP_200_OK)


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
