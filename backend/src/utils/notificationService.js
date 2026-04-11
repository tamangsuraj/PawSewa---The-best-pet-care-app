const Notification = require('../models/Notification');
const logger = require('./logger');
const { sendMulticastToUser } = require('./fcm');

/**
 * Create notification records for multiple users about a service request event.
 */
async function notifyServiceRequestAssignment({ ownerId, staffId, serviceRequestId, petName, serviceType, scheduledTimeLabel, staffName }) {
  const docs = [
    {
      user: ownerId,
      title: 'Service request assigned',
      message: `Your ${serviceType} request for ${petName} has been assigned to ${staffName} at ${scheduledTimeLabel}.`,
      type: 'service_request',
      serviceRequest: serviceRequestId,
    },
    {
      user: staffId,
      title: 'New service assignment',
      message: `You have been assigned a new ${serviceType} request for ${petName} at ${scheduledTimeLabel}.`,
      type: 'service_request',
      serviceRequest: serviceRequestId,
    },
  ];

  await Notification.create(docs);
}

/**
 * Owner-only in-app + push when a home-visit style status changes.
 */
async function notifyServiceRequestVisitStatusForOwner({
  ownerId,
  serviceRequestId,
  petName,
  serviceType,
  status,
  staffName,
}) {
  const st = String(status);
  const who = staffName && String(staffName).trim() ? String(staffName).trim() : 'Your veterinarian';
  let title;
  let message;
  if (st === 'accepted') {
    title = 'Visit accepted';
    message = `${who} accepted your ${serviceType} visit for ${petName}.`;
  } else if (st === 'en_route') {
    title = 'Vet is on the way';
    message = `${who} is on the way for your ${serviceType} visit (${petName}).`;
  } else if (st === 'arrived') {
    title = 'Vet has arrived';
    message = `${who} has arrived for your ${serviceType} visit (${petName}).`;
  } else if (st === 'in_progress') {
    title = 'Visit in progress';
    message = `${who} started your ${serviceType} visit for ${petName}.`;
  } else if (st === 'completed') {
    title = 'Visit completed';
    message = `Your ${serviceType} visit for ${petName} has been completed.`;
  } else {
    return;
  }

  await Notification.create({
    user: ownerId,
    title,
    message,
    type: 'service_request',
    serviceRequest: serviceRequestId,
  });

  try {
    await sendMulticastToUser(ownerId, {
      title,
      body: message,
      data: {
        type: 'service_request',
        serviceRequestId: String(serviceRequestId),
        status: st,
      },
    });
  } catch (e) {
    logger.warn('FCM service request visit status skipped:', e?.message || String(e));
  }
}

module.exports = {
  notifyServiceRequestAssignment,
  notifyServiceRequestVisitStatusForOwner,
};

