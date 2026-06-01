const Notification = require('../models/Notification');
const logger = require('./logger');
const { sendMulticastToUser, sendMulticastToAdmins } = require('./fcm');
const { SERVICE_REQUEST_STATUS } = require('../constants/serviceRequestStatus');

function formatVisitDate(preferredDate) {
  if (!preferredDate) return 'your scheduled date';
  const d = new Date(preferredDate);
  if (Number.isNaN(d.getTime())) return 'your scheduled date';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Create notification records for multiple users about a service request event.
 */
async function notifyServiceRequestAssignment({
  ownerId,
  staffId,
  serviceRequestId,
  petName,
  serviceType,
  scheduledTimeLabel,
  staffName,
  preferredDate,
}) {
  const visitDate = formatVisitDate(preferredDate);
  const docs = [
    {
      user: ownerId,
      title: 'Vet Assigned',
      message: `${staffName} has been assigned to your visit on ${visitDate}.`,
      type: 'service_request',
      serviceRequest: serviceRequestId,
    },
    {
      user: staffId,
      title: 'New Visit Assignment',
      message: `New ${serviceType} visit for ${petName} on ${scheduledTimeLabel}.`,
      type: 'service_request',
      serviceRequest: serviceRequestId,
    },
  ];

  await Notification.create(docs);

 
  try {
    await sendMulticastToUser(ownerId, {
      title: 'Vet Assigned',
      body: docs[0].message,
      data: {
        type: 'appointment_accepted',
        id: String(serviceRequestId),
        date: visitDate,
      },
    });
    await sendMulticastToUser(staffId, {
      title: 'New Visit Assignment',
      body: docs[1].message,
      data: {
        type: 'appointment_assigned',
        id: String(serviceRequestId),
        date: visitDate,
      },
    });
  } catch (e) {
    logger.warn('FCM assignment notify skipped:', e?.message || String(e));
  }
}

/** Owner confirmation when a booking is first created (pending review). */
async function notifyServiceRequestCreated({
  ownerId,
  serviceRequestId,
  petName,
  serviceType,
  preferredDate,
}) {
  const visitDate = formatVisitDate(preferredDate);
  const title = 'Booking Received';
  const message = `Your ${serviceType} booking for ${petName} on ${visitDate} is under review.`;

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
        type: 'service_request_created',
        id: String(serviceRequestId),
        date: visitDate,
      },
    });
  } catch (e) {
    logger.warn('FCM booking-created notify skipped:', e?.message || String(e));
  }
}

/** Alert admins that a new service request needs assignment. */
async function notifyAdminNewServiceRequest(serviceRequest) {
  const petName =
    serviceRequest.pet?.name || serviceRequest.petName || 'a pet';
  const serviceType = serviceRequest.serviceType || 'visit';
  try {
    await sendMulticastToAdmins({
      title: 'New booking',
      body: `New ${serviceType} request for ${petName} needs assignment.`,
      data: {
        type: 'service_request_created',
        id: String(serviceRequest._id),
      },
    });
  } catch (e) {
    logger.warn('FCM admin new-request notify skipped:', e?.message || String(e));
  }
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
  preferredDate,
  declineReason,
}) {
  const st = String(status);
  const who = staffName && String(staffName).trim() ? String(staffName).trim() : 'Your veterinarian';
  const visitDate = formatVisitDate(preferredDate);
  let title;
  let message;
  if (st === SERVICE_REQUEST_STATUS.ACCEPTED) {
    title = 'Visit accepted';
   
    message = `${who} has accepted your ${serviceType} appointment for ${petName} on ${visitDate}.`;
  } else if (st === SERVICE_REQUEST_STATUS.DECLINED) {
    title = 'Visit declined';
    const reason =
      declineReason && String(declineReason).trim()
        ? `: ${String(declineReason).trim()}`
        : '.';
    message = `${who} declined your ${serviceType} appointment for ${petName} on ${visitDate}${reason}`;
  } else if (st === SERVICE_REQUEST_STATUS.EN_ROUTE) {
    title = 'Vet is on the way';
    message = `${who} is on the way for your ${serviceType} visit (${petName}).`;
  } else if (st === SERVICE_REQUEST_STATUS.ARRIVED) {
    title = 'Vet has arrived';
    message = `${who} has arrived for your ${serviceType} visit (${petName}).`;
  } else if (st === SERVICE_REQUEST_STATUS.IN_PROGRESS) {
    title = 'Visit in progress';
    message = `${who} started your ${serviceType} visit for ${petName}.`;
  } else if (st === SERVICE_REQUEST_STATUS.COMPLETED) {
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
        type: st === SERVICE_REQUEST_STATUS.ACCEPTED ? 'appointment_accepted' : 'service_request_update',
        id: String(serviceRequestId),
        status: st,
        date: visitDate,
      },
    });
  } catch (e) {
    logger.warn('FCM service request visit status skipped:', e?.message || String(e));
  }
}

module.exports = {
  notifyServiceRequestAssignment,
  notifyServiceRequestCreated,
  notifyAdminNewServiceRequest,
  notifyServiceRequestVisitStatusForOwner,
};
