/**
 * Single source of truth for service request statuses.
 * Use these exact strings in:
 *   - Backend: ServiceRequest model default, createServiceRequest, filters
 *   - User App (Flutter): display and filters
 *   - Admin Panel: filterStatus options and GET /service-requests (no default filter = all; UI filters by 'pending', etc.)
 *   - Customer Website: my-service-requests filters
 *   - Vet App: my/assignments filter uses ASSIGNED + IN_PROGRESS
 */
const SERVICE_REQUEST_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  /** Assigned vet has confirmed they will perform the visit. */
  ACCEPTED: 'accepted',
  /** Vet / staff is travelling to the customer (home visit). */
  EN_ROUTE: 'en_route',
  /** Vet has arrived at the service location. */
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const ALL_STATUSES = Object.values(SERVICE_REQUEST_STATUS);

module.exports = {
  SERVICE_REQUEST_STATUS,
  ALL_STATUSES,
};
