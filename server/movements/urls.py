from django.urls import path

from .views import import_movements, list_movements

urlpatterns = [
    path('movements', list_movements),
    path('imports', import_movements),
]
