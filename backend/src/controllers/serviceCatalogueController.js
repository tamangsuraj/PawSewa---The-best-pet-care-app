const asyncHandler = require('express-async-handler');
const ServiceCatalogue = require('../models/ServiceCatalogue');
const { logAction } = require('../utils/auditLogger');
const getServices = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.includeInactive === 'true') {
    if (req.user?.role !== 'admin') {
      res.status(403);
      throw new Error('Admin only');
    }
    delete filter.isActive;
  }
  const services = await ServiceCatalogue.find(filter).sort({ name: 1 }).lean();
  res.json({ success: true, data: services });
});

const createService = asyncHandler(async (req, res) => {
  const service = await ServiceCatalogue.create(req.body);
  await logAction({
    action: 'create_service',
    performedBy: req.user._id,
    targetModel: 'ServiceCatalogue',
    targetId: service._id,
    targetLabel: service.name,
  });
  res.status(201).json({ success: true, data: service });
});

const updateService = asyncHandler(async (req, res) => {
  const service = await ServiceCatalogue.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  await logAction({
    action: 'update_service',
    performedBy: req.user._id,
    targetModel: 'ServiceCatalogue',
    targetId: service._id,
    targetLabel: service.name,
  });
  res.json({ success: true, data: service });
});

const toggleService = asyncHandler(async (req, res) => {
  const service = await ServiceCatalogue.findById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  service.isActive = !service.isActive;
  await service.save();
  res.json({ success: true, data: service });
});

module.exports = { getServices, createService, updateService, toggleService };
