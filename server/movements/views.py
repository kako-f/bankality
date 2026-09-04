from django.http import JsonResponse

from .models import Movement


def list_movements(request):
    return JsonResponse(list(Movement.objects.values(
        'date', 'description', 'amount', 'balance', 'category',
    )), safe=False)

# Create your views here.
