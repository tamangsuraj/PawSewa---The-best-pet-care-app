const Notification = require('../models/Notification');

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

module.exports = {
  notifyServiceRequestAssignment,
};

