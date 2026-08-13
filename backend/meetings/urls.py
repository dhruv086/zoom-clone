from django.urls import path, include
from rest_framework.routers import DefaultRouter
from meetings.views import UserViewSet, MeetingViewSet, ParticipantViewSet, ChatMessageViewSet

# The DRF DefaultRouter automatically hooks up standard list, retrieve, create, update, and destroy actions
# to their standard HTTP verbs and URL patterns. It is very similar to an Express router binding.
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'meetings', MeetingViewSet, basename='meeting')
router.register(r'participants', ParticipantViewSet, basename='participant')
router.register(r'chat', ChatMessageViewSet, basename='chat')

urlpatterns = [
    path('', include(router.urls)),
]
