import uuid
from django.db import models

class User(models.Model):
    """
    Equivalent to a Mongoose User Schema.
    In Mongo/Mongoose, this maps to a collection. In SQL, it maps to a table named 'users_user'.
    """
    display_name = models.CharField(max_length=100, default="Guest User")
    email = models.EmailField(max_length=255, null=True, blank=True)
    avatar_url = models.URLField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users_user'

    def __str__(self):
        return self.display_name


class Meeting(models.Model):
    """
    Equivalent to a Mongoose Meeting Schema.
    Instead of embedding host information, we normalize and reference User with a ForeignKey.
    In Mongoose: host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    In Django: models.ForeignKey(User, on_delete=models.CASCADE)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting_id = models.CharField(max_length=12, unique=True) # format: XXX-XXX-XXXX
    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_meetings')
    scheduled_at = models.DateTimeField(null=True, blank=True) # null = instant meeting
    duration_minutes = models.IntegerField(default=60)
    password = models.CharField(max_length=50, null=True, blank=True)
    invite_link = models.URLField(max_length=500)
    is_active = models.BooleanField(default=True)
    is_instant = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meetings_meeting'

    def __str__(self):
        return f"{self.title} ({self.meeting_id})"


class Participant(models.Model):
    """
    Represents a meeting participant.
    In MongoDB, this is often embedded as an array inside the meeting document.
    Here, it's normalized as a separate table to handle large and dynamic numbers of participants
    without reaching document size limits.
    """
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='participants')
    display_name = models.CharField(max_length=100)
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    is_host = models.BooleanField(default=False)
    is_video_on = models.BooleanField(default=True)
    is_audio_on = models.BooleanField(default=True)

    class Meta:
        db_table = 'meetings_participant'

    def __str__(self):
        return f"{self.display_name} in {self.meeting.meeting_id}"


class ChatMessage(models.Model):
    """
    Represents chat messages sent during the meeting.
    Points to a Meeting via ForeignKey.
    """
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='chat_messages')
    sender_name = models.CharField(max_length=100)
    content = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meetings_chatmessage'

    def __str__(self):
        return f"{self.sender_name}: {self.content[:20]}..."
