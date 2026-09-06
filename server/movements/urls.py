from django.urls import path

from .views import categories, category_detail, import_movements, list_movements, update_category

urlpatterns = [
    path('movements', list_movements),
    path('movements/<int:movement_id>/category', update_category),
    path('categories', categories),
    path('categories/<int:category_id>', category_detail),
    path('imports', import_movements),
]
