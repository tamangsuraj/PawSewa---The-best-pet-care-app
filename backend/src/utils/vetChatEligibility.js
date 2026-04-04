const mongoose = require('mongoose');
const Pet = require('../models/Pet');
const ServiceRequest = require('../models/ServiceRequest');
const Case = require('../models/Case');

const VET_ROLES = ['veterinarian', 'vet'];

/**
 * Canonical room id: pet owner user id _ veterinarian user id (not sorted).
 */
function makeVetDirectRoomId(ownerUserId, vetUserId) {
  return `${String(ownerUserId)}_${String(vetUserId)}`;
}

function socketRoomName(ownerId, vetId) {
  return `vetdirect:${makeVetDirectRoomId(ownerId, vetId)}`;
}

function parseRoomId(roomId) {
  const s = String(roomId || '');
  const i = s.indexOf('_');
  if (i <= 0 || i === s.length - 1) return null;
  return { ownerId: s.slice(0, i), vetId: s.slice(i + 1) };
}

/**
 * Vet user IDs eligible for 1:1 chat: completed visit, recorded visit notes, case assignment, or linkedVetVisits.
 */
async function collectVetIdsForOwner(ownerId) {
  const uid = new mongoose.Types.ObjectId(ownerId);
  const pets = await Pet.find({ owner: uid }).select('_id linkedVetVisits').lean();
  const petIds = pets.map((p) => p._id);
  if (petIds.length === 0) {
    return [];
  }

  const vetIds = new Set();

  for (const p of pets) {
    const visits = p.linkedVetVisits;
    if (!Array.isArray(visits)) continue;
    for (const v of visits) {
      if (v.veterinarian) vetIds.add(String(v.veterinarian));
    }
  }

  const srCond = {
    user: uid,
    pet: { $in: petIds },
    assignedStaff: { $ne: null },
    $or: [{ status: 'completed' }, { visitNotes: { $regex: /\S/ } }],
  };
  const srs = await ServiceRequest.find(srCond).select('assignedStaff').lean();
  for (const s of srs) {
    if (s.assignedStaff) vetIds.add(String(s.assignedStaff));
  }

  const cases = await Case.find({
    customer: uid,
    pet: { $in: petIds },
    assignedVet: { $ne: null },
    status: { $in: ['assigned', 'in_progress', 'completed'] },
  })
    .select('assignedVet')
    .lean();
  for (const c of cases) {
    if (c.assignedVet) vetIds.add(String(c.assignedVet));
  }

  return [...vetIds];
}

/**
 * Pet owner user IDs a vet may chat with (inverse of history rules).
 */
async function collectOwnerIdsForVet(vetId) {
  const vid = new mongoose.Types.ObjectId(vetId);
  const ownerIds = new Set();

  const srs = await ServiceRequest.find({
    assignedStaff: vid,
    $or: [{ status: 'completed' }, { visitNotes: { $regex: /\S/ } }],
  })
    .select('user')
    .lean();
  for (const s of srs) {
    if (s.user) ownerIds.add(String(s.user));
  }

  const cases = await Case.find({
    assignedVet: vid,
    status: { $in: ['assigned', 'in_progress', 'completed'] },
  })
    .select('customer')
    .lean();
  for (const c of cases) {
    if (c.customer) ownerIds.add(String(c.customer));
  }

  const pets = await Pet.find({ 'linkedVetVisits.veterinarian': vid }).select('owner').lean();
  for (const p of pets) {
    if (p.owner) ownerIds.add(String(p.owner));
  }

  return [...ownerIds];
}

async function canOwnerChatWithVet(ownerId, vetId) {
  const vets = await collectVetIdsForOwner(ownerId);
  return vets.includes(String(vetId));
}

async function canVetChatWithOwner(vetId, ownerId) {
  const owners = await collectOwnerIdsForVet(vetId);
  return owners.includes(String(ownerId));
}

module.exports = {
  VET_ROLES,
  makeVetDirectRoomId,
  parseRoomId,
  socketRoomName,
  collectVetIdsForOwner,
  collectOwnerIdsForVet,
  canOwnerChatWithVet,
  canVetChatWithOwner,
};
