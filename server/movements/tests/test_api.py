from django.test import Client, TestCase

from movements.models import Category, Movement


class MovementApiTests(TestCase):
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
