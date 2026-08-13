import random
from rest_framework import serializers
from meetings.models import User, Meeting, Participant, ChatMessage

def generate_meeting_id():
    """
    Generates a unique 10-digit meeting ID formatted as XXX-XXX-XXXX.
    """
    part1 = "".join(str(random.randint(0, 9)) for _ in range(3))
    part2 = "".join(str(random.randint(0, 9)) for _ in range(3))
    part3 = "".join(str(random.randint(0, 9)) for _ in range(4))
    return f"{part1}-{part2}-{part3}"


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'display_name', 'email', 'avatar_url', 'created_at']
        read_only_fields = ['id', 'created_at']


class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ['id', 'meeting', 'display_name', 'joined_at', 'left_at', 'is_host', 'is_video_on', 'is_audio_on']
        read_only_fields = ['id', 'joined_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'meeting', 'sender_name', 'content', 'sent_at']
        read_only_fields = ['id', 'sent_at']


class MeetingSerializer(serializers.ModelSerializer):
    host = UserSerializer(read_only=True)
    participants = ParticipantSerializer(many=True, read_only=True)
    active_participants_count = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            'id', 'meeting_id', 'title', 'description', 'host',
            'scheduled_at', 'duration_minutes', 'password', 'invite_link',
            'is_active', 'is_instant', 'created_at', 'participants',
            'active_participants_count'
        ]
        read_only_fields = ['id', 'meeting_id', 'invite_link', 'is_instant', 'is_active', 'created_at']

    def get_active_participants_count(self, obj):
        # Count participants who haven't left the meeting yet
        return obj.participants.filter(left_at__isnull=True).count()

    def create(self, validated_data):
        # Auto-assign the guest host user (id=1) as default if not passed in context/data
        host, _ = User.objects.get_or_create(id=1, defaults={'display_name': 'Guest User'})
        validated_data['host'] = host

        # Auto-generate a unique random meeting ID in 3-3-4 format
        mid = generate_meeting_id()
        while Meeting.objects.filter(meeting_id=mid).exists():
            mid = generate_meeting_id()
        
        validated_data['meeting_id'] = mid
        validated_data['invite_link'] = f"http://localhost:3000/join?mid={mid}"

        # If scheduled_at is null or not provided, mark as instant meeting
        scheduled_at = validated_data.get('scheduled_at')
        if not scheduled_at:
            validated_data['is_instant'] = True

        return super().create(validated_data)
