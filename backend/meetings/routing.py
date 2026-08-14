from django.urls import re_path

from meetings.consumers import MeetingSignalConsumer

websocket_urlpatterns = [
    re_path(r'ws/meetings/(?P<room_name>[^/]+)/$', MeetingSignalConsumer.as_asgi()),
]
