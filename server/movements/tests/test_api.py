import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Event
from unittest.mock import patch

from django.db import OperationalError, connections, transaction
from django.shortcuts import get_object_or_404
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, RequestFactory, TestCase, TransactionTestCase

from movements.models import Category, Movement
from movements.views import update_category


class MovementApiTests(TestCase):
    def test_previews_import_rows_without_storing_them(self):
        record = {
            'date': date(2026, 9, 4), 'description': 'Compra', 'amount': -2200,
            'balance': 10000, 'category': 'Compras',
        }
        upload = SimpleUploadedFile('movements.xls', b'fixture')
        with patch('movements.views.parse_xls', return_value=[record]):
            response = self.client.post('/api/imports/preview', {'files': upload})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['files'][0]['total'], 1)
        self.assertEqual(response.json()['files'][0]['rows'][0]['date'], '2026-09-04')
        self.assertEqual(response.json()['files'][0]['rows'][0]['description'], 'Compra')
        self.assertEqual(Movement.objects.count(), 0)

    def test_lists_canonical_categories_without_rewriting_historical_movements(self):
        movement = Movement.objects.create(
            date='2026-09-02', description='Compra', amount=-2200,
            balance=10, category=' \tCompras\u00a0 ', fingerprint='padded-list',
        )

        response = self.client.get('/api/movements')

        self.assertEqual(response.json()[0]['category'], 'Compras')
        movement.refresh_from_db()
        self.assertEqual(movement.category, ' \tCompras\u00a0 ')
        self.assertEqual(movement.fingerprint, 'padded-list')

    def test_renames_padded_historical_categories_without_changing_fingerprints(self):
        source = Category.objects.create(name='Mascotas')
        movement = Movement.objects.create(
            date='2026-09-02', description='Compra', amount=-2200,
            balance=10, category=' \tMascotas\u00a0 ', fingerprint='padded-rename',
        )

        response = self.client.patch(
            f'/api/categories/{source.id}', {'name': 'Veterinaria'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        movement.refresh_from_db()
        self.assertEqual(movement.category, 'Veterinaria')
        self.assertEqual(movement.fingerprint, 'padded-rename')

    def test_reassigns_padded_historical_categories_without_changing_fingerprints(self):
        source = Category.objects.create(name='Mascotas')
        replacement = Category.objects.get(name='Otros')
        movement = Movement.objects.create(
            date='2026-09-02', description='Compra', amount=-2200,
            balance=10, category=' \tMascotas\u00a0 ', fingerprint='padded-delete',
        )

        response = self.client.delete(
            f'/api/categories/{source.id}', {'replacement_id': replacement.id},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Category.objects.filter(id=source.id).exists())
        movement.refresh_from_db()
        self.assertEqual(movement.category, 'Otros')
        self.assertEqual(movement.fingerprint, 'padded-delete')

    def test_rejects_invalid_json_encoding_on_all_category_writes(self):
        source = Category.objects.create(name='Mascotas')
        client = Client(raise_request_exception=False)
        for method, url in (
            ('post', '/api/categories'),
            ('patch', f'/api/categories/{source.id}'),
            ('delete', f'/api/categories/{source.id}'),
            ('patch', '/api/movements/99999/category'),
        ):
            with self.subTest(method=method, url=url):
                response = getattr(client, method)(
                    url, b'{"name": "\xff"}', content_type='application/json',
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.json())

    def test_requires_string_category_names_for_create_and_rename(self):
        source = Category.objects.create(name='Mascotas')
        category_count = Category.objects.count()
        for value in (None, [], {}, 12, True):
            for method, url in (
                ('post', '/api/categories'),
                ('patch', f'/api/categories/{source.id}'),
            ):
                with self.subTest(value=value, method=method), transaction.atomic():
                    response = getattr(self.client, method)(
                        url, json.dumps({'name': value}), content_type='application/json',
                    )
                    self.assertEqual(response.status_code, 400)
                    source.refresh_from_db()
                    self.assertEqual(source.name, 'Mascotas')
                    self.assertEqual(Category.objects.count(), category_count)

    def test_lists_movements_in_date_order(self):
        Movement.objects.create(
            date='2026-09-02', description='Compra', amount=-2200,
            balance=3308103, category='Compras', fingerprint='second',
        )
        Movement.objects.create(
            date='2026-09-01', description='Abono', amount=1000,
            balance=3310303, category='Otros abonos', fingerprint='first',
        )

        response = self.client.get('/api/movements')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['date'] for item in response.json()], ['2026-09-01', '2026-09-02'])

    def test_updates_a_movement_category(self):
        Category.objects.get_or_create(name='Arriendo')
        movement = Movement.objects.create(
            date='2026-09-02', description='Transferencia', amount=-400000,
            balance=2908103, category='Transferencias', fingerprint='rent',
        )

        response = self.client.patch(
            f'/api/movements/{movement.id}/category', '{"category": "Arriendo"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['category'], 'Arriendo')
        movement.refresh_from_db()
        self.assertEqual(movement.category, 'Arriendo')

    def test_updates_a_movement_with_a_padded_catalog_name(self):
        Category.objects.get_or_create(name='Arriendo')
        movement = Movement.objects.create(
            date='2026-09-02', description='Transferencia', amount=-400000,
            balance=2908103, category='Transferencias', fingerprint='padded-target',
        )

        response = self.client.patch(
            f'/api/movements/{movement.id}/category', '{"category": " \\tArriendo\\u00a0 "}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['category'], 'Arriendo')
        movement.refresh_from_db()
        self.assertEqual(movement.category, 'Arriendo')
        self.assertEqual(movement.fingerprint, 'padded-target')

    def test_rejects_an_unknown_category(self):
        movement = Movement.objects.create(
            date='2026-09-02', description='Compra', amount=-2200,
            balance=3308103, category='Compras', fingerprint='purchase',
        )

        response = self.client.patch(
            f'/api/movements/{movement.id}/category', '{"category": "No existe"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        movement.refresh_from_db()
        self.assertEqual(movement.category, 'Compras')

    def test_accepts_a_category_update_from_the_local_dashboard(self):
        Category.objects.get_or_create(name='Arriendo')
        movement = Movement.objects.create(
            date='2026-09-02', description='Transferencia', amount=-400000,
            balance=2908103, category='Transferencias', fingerprint='local-origin',
        )
        client = Client(enforce_csrf_checks=True)
        token = 'a' * 32
        client.cookies['csrftoken'] = token

        response = client.patch(
            f'/api/movements/{movement.id}/category', '{"category": "Arriendo"}',
            content_type='application/json', HTTP_ORIGIN='http://localhost:5173',
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, 200)

    def test_lists_movements_with_a_csrf_cookie(self):
        response = self.client.get('/api/movements')

        self.assertIn('csrftoken', response.cookies)

    def test_creates_a_category(self):
        response = self.client.post(
            '/api/categories', '{"name": "Mascotas"}', content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Category.objects.filter(name='Mascotas').exists())

    def test_rejects_a_duplicate_category(self):
        Category.objects.create(name='Mascotas')

        response = self.client.post(
            '/api/categories', '{"name": " Mascotas "}', content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)

    def test_renames_category_and_its_movements(self):
        category = Category.objects.create(name='Mascotas')
        Movement.objects.create(
            date='2026-09-02', description='Cena', amount=-2000,
            balance=10, category='Mascotas', fingerprint='food',
        )

        response = self.client.patch(
            f'/api/categories/{category.id}', '{"name": "Restaurantes"}', content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Movement.objects.filter(category='Restaurantes').exists())

    def test_deletes_category_after_reassigning_movements(self):
        source = Category.objects.create(name='Mascotas')
        replacement = Category.objects.get(name='Otros')
        Movement.objects.create(
            date='2026-09-02', description='Cena', amount=-2000,
            balance=10, category='Mascotas', fingerprint='reassign',
        )

        response = self.client.delete(
            f'/api/categories/{source.id}', '{"replacement_id": %s}' % replacement.id,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Category.objects.filter(id=source.id).exists())
        self.assertTrue(Movement.objects.filter(category='Otros').exists())

    def test_rejects_an_unknown_replacement_category(self):
        source = Category.objects.create(name='Mascotas')

        response = self.client.delete(
            f'/api/categories/{source.id}', '{"replacement_id": 99999}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Category.objects.filter(id=source.id).exists())

    def test_rejects_a_boolean_replacement_category(self):
        source = Category.objects.create(name='Mascotas')
        movement = Movement.objects.create(
            date='2026-09-02', description='Cena', amount=-2000,
            balance=10, category='Mascotas', fingerprint='boolean-replacement',
        )

        response = self.client.delete(
            f'/api/categories/{source.id}', '{"replacement_id": true}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Category.objects.filter(id=source.id).exists())
        movement.refresh_from_db()
        self.assertEqual(movement.category, 'Mascotas')


    def test_rejects_a_float_replacement_category(self):
        source = Category.objects.create(name='Mascotas')
        movement = Movement.objects.create(
            date='2026-09-02', description='Cena', amount=-2000,
            balance=10, category='Mascotas', fingerprint='float-replacement',
        )

        response = self.client.delete(
            f'/api/categories/{source.id}', '{"replacement_id": 1.0}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Category.objects.filter(id=source.id).exists())
        movement.refresh_from_db()
        self.assertEqual(movement.category, 'Mascotas')


class ConcurrentCategoryTests(TransactionTestCase):
    def test_movement_update_does_not_restore_a_renamed_or_deleted_category(self):
        for method, payload, expected in (
            ('patch', {'name': 'Veterinaria'}, 'Veterinaria'),
            ('delete', None, 'Otros'),
        ):
            with self.subTest(method=method):
                source_name = f'Mascotas {method}'
                source = Category.objects.create(name=source_name)
                replacement, _ = Category.objects.get_or_create(name='Otros')
                movement = Movement.objects.create(
                    date='2026-09-02', description='Compra', amount=-2200,
                    balance=10, category='Otros', fingerprint=f'concurrent-{method}',
                )
                ready, resume = Event(), Event()

                def paused_movement_lookup(model, *args, **kwargs):
                    if getattr(model, 'model', model) is Movement:
                        ready.set()
                        if not resume.wait(5):
                            raise TimeoutError('Concurrent catalog update did not finish')
                    return get_object_or_404(model, *args, **kwargs)

                def assign_category():
                    try:
                        request = RequestFactory().patch(
                            f'/api/movements/{movement.id}/category', {'category': source_name},
                            content_type='application/json',
                        )
                        return update_category(request, movement.id)
                    finally:
                        connections.close_all()

                def change_catalog():
                    return getattr(self.client, method)(
                        f'/api/categories/{source.id}', payload or {'replacement_id': replacement.id},
                        content_type='application/json',
                    )

                with patch('movements.views.get_object_or_404', paused_movement_lookup), ThreadPoolExecutor(max_workers=1) as pool:
                    assignment = pool.submit(assign_category)
                    try:
                        self.assertTrue(ready.wait(5), 'Movement update did not finish category validation')
                        try:
                            catalog_response = change_catalog()
                        except OperationalError as error:
                            # SQLite rejects a competing writer while the assignment holds its read lock.
                            self.assertIn('locked', str(error))
                            catalog_response = None
                    finally:
                        resume.set()
                    self.assertEqual(assignment.result(timeout=5).status_code, 200)

                if catalog_response is None:
                    catalog_response = change_catalog()
                self.assertEqual(catalog_response.status_code, 200)
                movement.refresh_from_db()
                self.assertEqual(movement.category, expected)
                self.assertEqual(movement.fingerprint, f'concurrent-{method}')
