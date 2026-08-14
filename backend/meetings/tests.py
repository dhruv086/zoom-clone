from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from meetings.models import Meeting, Participant, User


class MeetingParticipantAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create(display_name='Host User')
        self.meeting = Meeting.objects.create(
            title='Team Sync',
            host=self.host,
            meeting_id='123-456-7890',
            invite_link='http://localhost:3000/join?mid=123-456-7890',
            scheduled_at=timezone.now(),
        )
        self.host_participant = Participant.objects.create(
            meeting=self.meeting,
            display_name='Host User',
            is_host=True,
            is_audio_on=True,
            is_video_on=True,
        )
        self.other_participant = Participant.objects.create(
            meeting=self.meeting,
            display_name='Guest User',
            is_host=False,
            is_audio_on=True,
            is_video_on=True,
        )

    def test_toggle_audio_persists_state(self):
        url = reverse('participant-toggle-audio', kwargs={'pk': self.other_participant.pk})
        response = self.client.post(url, {'is_audio_on': False}, format='json')

        self.assertEqual(response.status_code, 200)
        self.other_participant.refresh_from_db()
        self.assertFalse(self.other_participant.is_audio_on)

    def test_mute_all_turns_off_all_active_participants(self):
        url = reverse('meeting-mute-all', kwargs={'pk': self.meeting.pk})
        response = self.client.post(url, {
            'participant_id': self.host_participant.id,
            'host_access_token': str(self.meeting.host_access_token),
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.host_participant.refresh_from_db()
        self.other_participant.refresh_from_db()
        
        # Host remains unmuted
        self.assertTrue(self.host_participant.is_audio_on)
        # Other participant is muted
        self.assertFalse(self.other_participant.is_audio_on)

    def test_non_host_cannot_mute_all(self):
        url = reverse('meeting-mute-all', kwargs={'pk': self.meeting.pk})
        response = self.client.post(url, {'participant_id': self.other_participant.id}, format='json')

        self.assertEqual(response.status_code, 403)

    def test_kick_participant_by_host(self):
        url = reverse('participant-kick', kwargs={'pk': self.other_participant.pk})
        response = self.client.post(url, {
            'host_access_token': str(self.meeting.host_access_token),
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.other_participant.refresh_from_db()
        self.assertIsNotNone(self.other_participant.left_at)

    def test_kick_participant_by_non_host_fails(self):
        url = reverse('participant-kick', kwargs={'pk': self.other_participant.pk})
        response = self.client.post(url, {
            'host_access_token': 'wrong-token',
        }, format='json')

        self.assertEqual(response.status_code, 403)
