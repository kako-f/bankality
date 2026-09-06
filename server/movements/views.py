import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Category, Movement
from .parsers import parse_pdf, parse_xls
from .services import store_records


def json_payload(request):
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return None, JsonResponse({'error': 'JSON no reconocido'}, status=400)
    if not isinstance(payload, dict):
        return None, JsonResponse({'error': 'JSON no reconocido'}, status=400)
    return payload, None


def category_name(payload):
    name = str(payload.get('name', '')).strip()
    if not name or len(name) > 80:
        return None, JsonResponse({'error': 'Nombre de categoría no reconocido'}, status=400)
    return name, None


@ensure_csrf_cookie
def list_movements(request):
    return JsonResponse(list(Movement.objects.values(
        'id', 'date', 'description', 'amount', 'balance', 'category',
    )), safe=False)


def update_category(request, movement_id):
    if request.method != 'PATCH':
        return JsonResponse({'error': 'Usa PATCH para actualizar una categoría'}, status=405)
    payload, error = json_payload(request)
    if error:
        return error
    category = payload.get('category')
    if not isinstance(category, str) or not Category.objects.filter(name=category).exists():
        return JsonResponse({'error': 'Categoría no reconocida'}, status=400)
    movement = get_object_or_404(Movement, id=movement_id)
    movement.category = category
    movement.save(update_fields=['category'])
    return JsonResponse({'id': movement.id, 'category': movement.category})


def categories(request):
    if request.method == 'GET':
        return JsonResponse(list(Category.objects.values('id', 'name')), safe=False)
    if request.method != 'POST':
        return JsonResponse({'error': 'Usa GET o POST para categorías'}, status=405)
    payload, error = json_payload(request)
    if error:
        return error
    name, error = category_name(payload)
    if error:
        return error
    try:
        category = Category.objects.create(name=name)
    except IntegrityError:
        return JsonResponse({'error': 'Nombre de categoría no reconocido'}, status=400)
    return JsonResponse({'id': category.id, 'name': category.name}, status=201)


def category_detail(request, category_id):
    if request.method not in ('PATCH', 'DELETE'):
        return JsonResponse({'error': 'Usa PATCH o DELETE para categorías'}, status=405)
    payload, error = json_payload(request)
    if error:
        return error
    try:
        with transaction.atomic():
            category = get_object_or_404(Category.objects.select_for_update(), id=category_id)
            if request.method == 'PATCH':
                name, error = category_name(payload)
                if error:
                    return error
                old_name = category.name
                category.name = name
                category.save()
                Movement.objects.filter(category=old_name).update(category=name)
                return JsonResponse({'id': category.id, 'name': category.name})
            try:
                replacement = Category.objects.select_for_update().filter(
                    id=payload.get('replacement_id'),
                ).first()
            except (TypeError, ValueError):
                replacement = None
            if replacement is None or replacement.id == category.id:
                return JsonResponse({'error': 'Categoría de reemplazo no reconocida'}, status=400)
            Movement.objects.filter(category=category.name).update(category=replacement.name)
            deleted = category.id
            category.delete()
    except IntegrityError:
        return JsonResponse({'error': 'Nombre de categoría no reconocido'}, status=400)
    return JsonResponse({'deleted': deleted})


def import_movements(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Usa POST para importar archivos'}, status=405)
    results = []
    for upload in request.FILES.getlist('files'):
        try:
            parser = parse_xls if upload.name.lower().endswith('.xls') else parse_pdf if upload.name.lower().endswith('.pdf') else None
            if parser is None:
                raise ValueError('Formato no reconocido')
            imported, skipped = store_records(parser(upload))
            results.append({'name': upload.name, 'imported': imported, 'skipped': skipped, 'error': ''})
        except ValueError as error:
            results.append({'name': upload.name, 'imported': 0, 'skipped': 0, 'error': str(error)})
    return JsonResponse({'files': results})

# Create your views here.
