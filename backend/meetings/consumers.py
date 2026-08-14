import json
from typing import Dict

from channels.generic.websocket import AsyncWebsocketConsumer

MEETING_ROOMS: Dict[str, Dict[str, str]] = {}


class MeetingSignalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'meeting_{self.room_name}'
        self.participant_id = None
        self.display_name = 'Guest User'

    async def disconnect(self, close_code):
        if not self.participant_id:
            return

        room = MEETING_ROOMS.get(self.room_group_name, {})
        room.pop(self.participant_id, None)
        if not room:
            MEETING_ROOMS.pop(self.room_group_name, None)
        else:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'peer.left',
                    'participant_id': self.participant_id,
                    'display_name': self.display_name,
                },
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'join':
            self.participant_id = str(data.get('participantId'))
            self.display_name = data.get('displayName', 'Guest User')
            room = MEETING_ROOMS.setdefault(self.room_group_name, {})
            room[self.participant_id] = self.display_name

            await self.send(text_data=json.dumps({
                'type': 'existing_participants',
                'participants': [
                    {'participantId': pid, 'displayName': name}
                    for pid, name in room.items() if pid != self.participant_id
                ],
            }))

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'peer.joined',
                    'participant_id': self.participant_id,
                    'display_name': self.display_name,
                },
            )
            return

        if message_type == 'signal' and self.participant_id:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'signal.message',
                    'from': self.participant_id,
                    'to': data.get('to'),
                    'signal': data.get('signal'),
                },
            )
            return

    async def peer_joined(self, event):
        if self.participant_id == event.get('participant_id'):
            return
        await self.send(text_data=json.dumps({
            'type': 'peer.joined',
            'participantId': event.get('participant_id'),
            'displayName': event.get('display_name'),
        }))

    async def peer_left(self, event):
        if self.participant_id == event.get('participant_id'):
            return
        await self.send(text_data=json.dumps({
            'type': 'peer.left',
            'participantId': event.get('participant_id'),
            'displayName': event.get('display_name'),
        }))

    async def signal_message(self, event):
        if self.participant_id == event.get('to'):
            await self.send(text_data=json.dumps({
                'type': 'signal',
                'from': event.get('from'),
                'signal': event.get('signal'),
            }))
