const asyncHandler = require('express-async-handler');
const Zone = require('../models/Zone');
const User = require('../models/User');
const { logAction } = require('../utils/auditLogger');
const createZone = asyncHandler(async (req, res) => {
  const { name, districts, polygonCoords, isActive } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('Zone name is required');
  }
  const zone = await Zone.create({
    name: String(name).trim(),
    districts: Array.isArray(districts) ? districts.map((d) => String(d).trim()).filter(Boolean) : [],
    polygonCoords: Array.isArray(polygonCoords) ? polygonCoords : undefined,
    isActive: isActive !== false,
  });
  await logAction({
    action: 'create_zone',
    performedBy: req.user._id,
    targetModel: 'Zone',
    targetId: zone._id,
    targetLabel: zone.name,
  });
  res.status(201).json({ success: true, data: zone });
});

const getAllZones = asyncHandler(async (req, res) => {
  const zones = await Zone.find().sort({ name: 1 }).lean();
  const withCounts = await Promise.all(
    zones.map(async (z) => {
      const vetCount = await User.countDocuments({
        zone: z._id,
        role: { $in: ['veterinarian', 'vet', 'VET'] },
      });
      return { ...z, vetCount };
    })
  );
  res.json({ success: true, count: withCounts.length, data: withCounts });
});

const updateZone = asyncHandler(async (req, res) => {
  const zone = await Zone.findById(req.params.id);
  if (!zone) {
    res.status(404);
    throw new Error('Zone not found');
  }
  const { name, districts, polygonCoords, isActive } = req.body || {};
  if (name != null) zone.name = String(name).trim();
  if (districts != null) {
    zone.districts = Array.isArray(districts) ? districts.map((d) => String(d).trim()).filter(Boolean) : [];
  }
  if (polygonCoords != null) zone.polygonCoords = polygonCoords;
  if (typeof isActive === 'boolean') zone.isActive = isActive;
  await zone.save();
  await logAction({
    action: 'update_zone',
    performedBy: req.user._id,
    targetModel: 'Zone',
    targetId: zone._id,
    targetLabel: zone.name,
  });
  res.json({ success: true, data: zone });
});

const deleteZone = asyncHandler(async (req, res) => {
  const zone = await Zone.findById(req.params.id);
  if (!zone) {
    res.status(404);
    throw new Error('Zone not found');
  }
  const label = zone.name;
  await zone.deleteOne();
  await logAction({
    action: 'delete_zone',
    performedBy: req.user._id,
    targetModel: 'Zone',
    targetId: req.params.id,
    targetLabel: label,
  });
  res.json({ success: true, message: 'Zone deleted' });
});

module.exports = { createZone, getAllZones, updateZone, deleteZone };
