/**
 * PawSewa core modules registry (VRS, VAS, CCBS, MVM, PPS) — maps product language to live API surface.
 * All data lives in DB_NAME (e.g. pawsewa_chat).
 */
const express = require('express');

const router = express.Router();

router.get('/modules', (req, res) => {
  res.json({
    success: true,
    data: {
      databaseEnv: process.env.DB_NAME || null,
      modules: [
        {
          code: 'VRS',
          name: 'Vaccination Reminders',
          description: 'Pet reminder engine + scheduled pushes',
          api: ['/api/v1/reminders', '/api/v1/pets/:id/health-summary'],
        },
        {
          code: 'VAS',
          name: 'Vet Scheduler',
          description: 'Assignments, clinic queue, clinical entries',
          api: [
            '/api/v1/service-requests/my/tasks',
            '/api/v1/pets/:id/clinical-entry',
            '/api/v1/appointments',
          ],
        },
        {
          code: 'CCBS',
          name: 'Care Centre Booking',
          description: 'Hostel / grooming / training bookings + owner respond',
          api: ['/api/v1/care-bookings', '/api/v1/hostels', '/api/v1/care-centers', '/api/v1/trainings'],
        },
        {
          code: 'MVM',
          name: 'Messaging',
          description: 'Unified chat, marketplace, vet-direct, customer care',
          api: ['/api/v1/chats', '/api/v1/marketplace-chat', '/api/v1/customer-care'],
        },
        {
          code: 'PPS',
          name: 'Pet Product Shop',
          description: 'Catalogue, orders, rider assignment',
          api: ['/api/v1/orders', '/api/v1/products'],
        },
      ],
    },
  });
});

module.exports = router;
