from django.urls import path

from .views import list_movements

urlpatterns = [
    path('movements', list_movements),
]
