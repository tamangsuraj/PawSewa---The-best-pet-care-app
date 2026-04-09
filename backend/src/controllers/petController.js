const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Pet = require('../models/Pet');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const { generatePetRemindersV1 } = require('../utils/reminderEngine');
const {
  buildWeightChart6Months,
  pushWeightHistoryEntry,
} = require('../utils/petWeightChart');

/** Assign PawID via model pre-save hook when missing (legacy data). */
async function ensurePetHasPawId(petId) {
  const doc = await Pet.findById(petId);
  if (!doc || doc.pawId) return;
  await doc.save();
}

/**
 * @desc    Create a new pet (persisted with Mongoose `Pet` → MongoDB collection `pets`; no mock store).
 * @route   POST /api/v1/pets
 * @access  Private
 */
const createPet = asyncHandler(async (req, res) => {
  try {
    const {
      name,
      species,
      breed,
      dob,
      age,
      gender,
      weight,
      medicalConditions,
      behavioralNotes,
      isVaccinated,
      medicalHistory,
      isOutdoor,
    } = req.body || {};

    let photoUrl = '';
    let cloudinaryPublicId = '';

    if (req.file) {
      photoUrl = req.file.path || '';
      cloudinaryPublicId = req.file.filename || '';
    }

    let parsedMedicalHistory = [];
    if (medicalHistory) {
      if (typeof medicalHistory === 'string') {
        try {
          parsedMedicalHistory = JSON.parse(medicalHistory);
        } catch (e) {
          parsedMedicalHistory = [medicalHistory];
        }
      } else if (Array.isArray(medicalHistory)) {
        parsedMedicalHistory = medicalHistory;
      }
    }

    const wn = weight !== undefined && weight !== null && weight !== '' ? Number(weight) : NaN;
    const initialWeightHistory = [];
    if (!Number.isNaN(wn) && wn >= 0) {
      initialWeightHistory.push({ recordedAt: new Date(), weightKg: wn, source: 'owner' });
    }

    const pet = await Pet.create({
      owner: req.user._id,
      name: name ?? '',
      species: species ?? '',
      breed: breed ?? undefined,
      dob: dob ? new Date(dob) : undefined,
      age,
      isOutdoor: isOutdoor === 'true' || isOutdoor === true,
      gender: gender ?? '',
      weight: !Number.isNaN(wn) && wn >= 0 ? wn : weight,
      weightHistory: initialWeightHistory,
      photoUrl,
      cloudinaryPublicId,
      medicalConditions,
      behavioralNotes,
      isVaccinated: isVaccinated === 'true' || isVaccinated === true,
      medicalHistory: Array.isArray(parsedMedicalHistory) ? parsedMedicalHistory : [],
      reminders:
        dob && (species === 'Dog' || species === 'Cat' || species === 'dog' || species === 'cat')
          ? generatePetRemindersV1({
              dob: new Date(dob),
              species,
              isOutdoor: isOutdoor === 'true' || isOutdoor === true,
            })
          : [],
    });

    logger.info(
      'Reminder Engine: Generated',
      Array.isArray(pet.reminders) ? pet.reminders.length : 0,
      'medical alerts for Pet',
      pet._id.toString()
    );

    res.status(201).json({
      success: true,
      message: 'Pet created successfully',
      data: pet,
    });
  } catch (error) {
    logger.error('Pets: create failed:', error?.message ?? error);
    res.status(500).json({
      success: false,
      message: 'Failed to create pet',
      error: error.message,
    });
  }
});

/**
 * @desc    Get all pets for logged-in user
 * @route   GET /api/v1/pets/my-pets
 * @access  Private
 */
const getMyPets = asyncHandler(async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    logger.debug('Pets: list my-pets user=', req.user._id.toString());

    let pets = await Pet.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    for (const p of pets || []) {
      if (!p.pawId) {
        // eslint-disable-next-line no-await-in-loop
        const doc = await Pet.findById(p._id);
        if (doc && !doc.pawId) {
          // eslint-disable-next-line no-await-in-loop
          await doc.save();
        }
      }
    }

    pets = await Pet.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const baseUrl = process.env.BASE_URL || '';
    const safePets = (pets || []).map((pet) => {
      const p = pet && typeof pet === 'object' ? pet : {};
      const photoUrl = p.photoUrl;
      const resolvedPhoto =
        photoUrl && typeof photoUrl === 'string'
          ? photoUrl.startsWith('http')
            ? photoUrl
            : baseUrl
              ? `${String(baseUrl).replace(/\/$/, '')}/uploads/${photoUrl}`
              : photoUrl
          : null;
      return {
        ...p,
        pawId: p.pawId || 'PENDING',
        photoUrl: resolvedPhoto ?? p.photoUrl ?? null,
      };
    });

    res.status(200).json({
      success: true,
      count: safePets.length,
      data: safePets,
    });
  } catch (error) {
    logger.error('Pets: list my-pets failed:', error?.message ?? error);
    return res.status(200).json({
      success: true,
      count: 0,
      data: [],
    });
  }
});

/**
 * @desc    Get all pets (admin), optionally filtered by unique PawID only (?pawId=)
 * @route   GET /api/v1/pets/admin
 * @access  Private/Admin
 */
const getAllPets = asyncHandler(async (req, res) => {
  try {
    const { pawId } = req.query || {};
    const filter = {};

    if (pawId && typeof pawId === 'string') {
      const q = pawId.trim();
      if (q) {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.pawId = new RegExp(escaped, 'i');
      }
    }

    const pets = await Pet.find(filter)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();
    const list = Array.isArray(pets) ? pets : [];

    res.status(200).json({
      success: true,
      count: list.length,
      data: list,
    });
  } catch (error) {
    logger.error('Pets: admin list failed:', error?.message ?? error);
    res.status(200).json({
      success: true,
      count: 0,
      data: [],
    });
  }
});

/**
 * @desc    Get single pet by ID
 * @route   GET /api/v1/pets/:id
 * @access  Private
 */
const getPetById = asyncHandler(async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Pet ID required' });
    }
    const pet = await Pet.findById(id).populate('owner', 'name email').lean();
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    const ownerId = pet.owner?._id?.toString() ?? pet.owner?.toString?.() ?? '';
    const userId = req.user?._id?.toString() ?? '';
    if (ownerId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to access this pet' });
    }
    if (!pet.pawId) {
      await ensurePetHasPawId(id);
      const petOut = await Pet.findById(id).populate('owner', 'name email').lean();
      return res.status(200).json({ success: true, data: petOut });
    }
    res.status(200).json({
      success: true,
      data: pet,
    });
  } catch (error) {
    logger.error('Pets: get detail failed:', error?.message ?? error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * @desc    Get pet health summary (for dashboard): basic info + age, visit_days_ago
 * @route   GET /api/v1/pets/:id/health-summary
 * @access  Private
 */
/** Pull bare URLs from clinical text for attachment thumbnails in the owner app. */
function extractUrlsFromText(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  const re = /https?:\/\/[^\s)\]'">]+/gi;
  const raw = text.match(re) || [];
  const cleaned = raw.map((u) => u.replace(/[.,;:!?)]+$/, ''));
  return [...new Set(cleaned)];
}

function formatShortDate(d) {
  if (!d) {
    return '';
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) {
    return '';
  }
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @desc    Medical timeline for one pet (service requests + visit notes; owner-only).
 * @route   GET /api/v1/pets/:id/medical-history
 * @access  Private
 */
const getPetMedicalHistory = asyncHandler(async (req, res) => {
  try {
    const petId = req.params?.id;
    if (!petId) {
      return res.status(400).json({ success: false, message: 'Pet ID required' });
    }
    if (!mongoose.Types.ObjectId.isValid(petId)) {
      return res.status(400).json({ success: false, message: 'Invalid pet id' });
    }
    const pet = await Pet.findById(petId).lean();
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    const ownerId = (pet.owner && typeof pet.owner === 'object' ? pet.owner._id : pet.owner)?.toString() ?? '';
    const userId = req.user?._id?.toString() ?? '';
    if (ownerId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to access this pet' });
    }

    const requests = await ServiceRequest.find({ pet: petId })
      .populate('assignedStaff', 'name email phone specialty')
      .sort({ completedAt: -1, preferredDate: -1, createdAt: -1 })
      .lean();

    const baseUrl = process.env.BASE_URL || '';

    const records = requests.map((r, idx) => {
      const idStr = r._id.toString();
      const appointmentNumber = idStr.slice(-6).toUpperCase();
      const staff = r.assignedStaff;
      let doctorName = 'Your veterinary team';
      if (staff && typeof staff === 'object') {
        const n = (staff.name || '').trim();
        if (n) {
          doctorName = n.toLowerCase().startsWith('dr.') ? n : `Dr. ${n}`;
        }
      }

      const visitDate = r.completedAt || r.preferredDate || r.createdAt;
      const visitNotes = (r.visitNotes && String(r.visitNotes).trim()) || '';
      const ownerNotes = (r.notes && String(r.notes).trim()) || '';
      const diagnosis =
        visitNotes ||
        ownerNotes ||
        'No clinical notes have been recorded for this visit yet.';

      const adminNotes = (r.adminNotes && String(r.adminNotes).trim()) || '';
      let prescribed = adminNotes;
      if (!prescribed) {
        prescribed = 'No separate prescription or treatment list on file. See diagnosis notes or attached documents.';
      }
      if (r.prescriptionUrl) {
        prescribed = `${prescribed}\n\nA prescription or discharge document is available in the full report.`.trim();
      }

      let prescriptionResolved = r.prescriptionUrl || null;
      if (
        prescriptionResolved &&
        typeof prescriptionResolved === 'string' &&
        !prescriptionResolved.startsWith('http') &&
        baseUrl
      ) {
        prescriptionResolved = `${String(baseUrl).replace(/\/$/, '')}/uploads/${prescriptionResolved}`;
      }

      const attachments = [];
      if (prescriptionResolved) {
        attachments.push({
          type: 'prescription',
          url: prescriptionResolved,
          label: 'Prescription',
        });
      }
      const extraUrls = extractUrlsFromText(`${visitNotes}\n${ownerNotes}`);
      for (const u of extraUrls) {
        if (prescriptionResolved && u === prescriptionResolved) {
          continue;
        }
        attachments.push({
          type: 'link',
          url: u,
          label: 'Attachment',
        });
      }

      const badges = [];
      const st = r.status || '';
      if (st === 'completed' && r.completedAt) {
        badges.push({
          type: 'resolved',
          label: `Case resolved: ${formatShortDate(r.completedAt)}`,
        });
      }
      const now = Date.now();
      if (r.scheduledTime && st !== 'completed') {
        const t = new Date(r.scheduledTime).getTime();
        if (!Number.isNaN(t) && t > now) {
          badges.push({
            type: 'followup',
            label: `Follow-up: ${formatShortDate(r.scheduledTime)}`,
          });
        }
      } else if (idx === 0 && pet.nextVaccinationDate) {
        const nv = new Date(pet.nextVaccinationDate).getTime();
        if (!Number.isNaN(nv) && nv >= new Date().setHours(0, 0, 0, 0)) {
          badges.push({
            type: 'followup',
            label: `Follow-up: ${formatShortDate(pet.nextVaccinationDate)}`,
          });
        }
      }

      const rv = r.visitVitals || {};
      const w0 = rv.weightKg != null ? Number(rv.weightKg) : (pet.weight != null ? Number(pet.weight) : null);
      const t0 = rv.temperatureC != null ? Number(rv.temperatureC) : null;
      const h0 = rv.heartRateBpm != null ? Number(rv.heartRateBpm) : null;
      const vitals = {
        weightKg: Number.isFinite(w0) ? w0 : null,
        temperatureC: Number.isFinite(t0) ? t0 : null,
        heartRateBpm: Number.isFinite(h0) ? h0 : null,
      };

      return {
        id: idStr,
        serviceRequestId: idStr,
        appointmentNumber,
        title: r.serviceType || 'Veterinary visit',
        date: visitDate,
        doctorName,
        diagnosis,
        prescribed,
        status: st,
        completedAt: r.completedAt || null,
        scheduledTime: r.scheduledTime || null,
        prescriptionUrl: prescriptionResolved,
        attachments,
        internalNotes: '',
        vitals,
        serviceType: r.serviceType || null,
        badges,
      };
    });

    const petAug = await Pet.findById(petId)
      .populate('linkedVetVisits.veterinarian', 'name')
      .select('linkedVetVisits')
      .lean();

    const vetLinkedRecords = [];
    const linked = (petAug && petAug.linkedVetVisits) || [];
    for (let i = 0; i < linked.length; i += 1) {
      const v = linked[i];
      const vet = v.veterinarian;
      let doctorName = 'Your veterinary team';
      if (vet && typeof vet === 'object' && vet.name) {
        const n = String(vet.name).trim();
        doctorName = n.toLowerCase().startsWith('dr.') ? n : `Dr. ${n}`;
      }
      const summary = (v.summary && String(v.summary).trim()) || 'Clinical update recorded.';
      const visitDate = v.recordedAt || new Date();
      const idStr = v._id ? v._id.toString() : `lv-${i}`;
      vetLinkedRecords.push({
        id: `linked-${idStr}`,
        serviceRequestId: null,
        appointmentNumber: 'CLINIC',
        title: 'Veterinary clinical record',
        date: visitDate,
        doctorName,
        diagnosis: summary,
        prescribed:
          'Prescription and full notes may be attached to the service visit or provided at discharge.',
        status: 'completed',
        completedAt: visitDate,
        scheduledTime: null,
        prescriptionUrl: null,
        attachments: [],
        internalNotes: '',
        vitals: {
          weightKg: pet.weight != null ? Number(pet.weight) : null,
          temperatureC: null,
          heartRateBpm: null,
        },
        serviceType: 'clinical_entry',
        badges: [],
      });
    }

    const merged = [...records, ...vetLinkedRecords].sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });

    res.status(200).json({
      success: true,
      count: merged.length,
      data: merged,
      pet: {
        name: pet.name,
        nextVaccinationDate: pet.nextVaccinationDate || null,
        weight: pet.weight != null ? Number(pet.weight) : null,
      },
    });
  } catch (error) {
    logger.error('Pets: medical history failed:', error?.message ?? error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * @desc    Veterinarian adds diagnosis / prescription (shows in owner medical timeline + notifications).
 * @route   POST /api/v1/pets/:id/clinical-entry
 * @access  Private / veterinarian or admin
 */
const addVetClinicalEntry = asyncHandler(async (req, res) => {
  const petId = req.params?.id;
  if (!petId || !mongoose.Types.ObjectId.isValid(petId)) {
    return res.status(400).json({ success: false, message: 'Valid pet id required' });
  }

  const { diagnosis, prescription, notes, serviceRequestId } = req.body || {};
  const dx = diagnosis != null ? String(diagnosis).trim() : '';
  if (!dx) {
    return res.status(400).json({ success: false, message: 'diagnosis is required' });
  }

  const pet = await Pet.findById(petId);
  if (!pet) {
    return res.status(404).json({ success: false, message: 'Pet not found' });
  }

  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'admin') {
    const q = { pet: petId, assignedStaff: req.user._id };
    if (serviceRequestId && mongoose.Types.ObjectId.isValid(String(serviceRequestId))) {
      q._id = serviceRequestId;
    }
    const ok = await ServiceRequest.exists(q);
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: 'You must be assigned to this pet via a service request to add clinical entries.',
      });
    }
  }

  const vet = await User.findById(req.user._id).select('name');
  const vetName = (vet && vet.name && String(vet.name).trim()) || 'Your veterinarian';
  const rx = prescription != null ? String(prescription).trim() : '';
  const nt = notes != null ? String(notes).trim() : '';
  const line = `[PawSewa Clinical] ${new Date().toISOString()} | ${vetName} | Diagnosis: ${dx} | Rx: ${rx}${
    nt ? ` | Notes: ${nt}` : ''
  }`;

  if (!Array.isArray(pet.medicalHistory)) {
    pet.medicalHistory = [];
  }
  pet.medicalHistory.push(line);
  if (!Array.isArray(pet.linkedVetVisits)) {
    pet.linkedVetVisits = [];
  }
  pet.linkedVetVisits.push({
    veterinarian: req.user._id,
    summary: dx.slice(0, 500),
    recordedAt: new Date(),
  });
  pet.lastVetVisit = new Date();
  await pet.save();

  try {
    await Notification.create({
      user: pet.owner,
      title: 'New vet clinical record',
      message: `${vetName} added a clinical update for ${pet.name}.`,
      type: 'system',
    });
  } catch (e) {
    logger.warn('Clinical entry saved but notification failed:', e.message);
  }

  res.status(201).json({
    success: true,
    message: 'Clinical entry saved',
    data: { petId: pet._id },
  });
});

const getPetHealthSummary = asyncHandler(async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Pet ID required' });
    }
    const pet = await Pet.findById(id).lean();
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    const ownerId = (pet.owner && typeof pet.owner === 'object' ? pet.owner._id : pet.owner)?.toString() ?? '';
    const userId = req.user?._id?.toString() ?? '';
    if (ownerId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to access this pet' });
    }

    if (!pet.pawId) {
      await ensurePetHasPawId(id);
    }
    let petDoc = await Pet.findById(id).lean();
    if (!petDoc) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    const baseUrl = process.env.BASE_URL || '';
    const photoUrl = petDoc.photoUrl;
    const resolvedPhoto =
      photoUrl && typeof photoUrl === 'string' && !photoUrl.startsWith('http') && baseUrl
        ? `${String(baseUrl).replace(/\/$/, '')}/uploads/${photoUrl}`
        : photoUrl;

    let age = null;
    if (petDoc.dob) {
      const now = new Date();
      const birth = new Date(petDoc.dob);
      const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      const years = Math.floor(totalMonths / 12);
      const months = totalMonths % 12;
      age = years >= 1 ? { years, months, display: `${years} ${years === 1 ? 'year' : 'years'}` } : { years: 0, months: totalMonths, display: `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}` };
    } else if (typeof petDoc.age === 'number') {
      age = { years: petDoc.age, months: 0, display: `${petDoc.age} ${petDoc.age === 1 ? 'year' : 'years'}` };
    }

    let visit_days_ago = null;
    if (petDoc.lastVetVisit) {
      const last = new Date(petDoc.lastVetVisit);
      visit_days_ago = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
    }

    const weightChart6m = buildWeightChart6Months(petDoc);
    const { weightHistory = [], ...petRest } = petDoc;
    const weightHistoryRecent = [...weightHistory]
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      .slice(0, 48);

    const payload = {
      ...petRest,
      weightHistory: weightHistoryRecent,
      weightChart6m,
      photoUrl: resolvedPhoto ?? petDoc.photoUrl ?? null,
      age,
      visit_days_ago,
    };

    res.status(200).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    logger.error('Pets: health summary failed:', error?.message ?? error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

/**
 * @desc    Update pet
 * @route   PUT /api/v1/pets/:id
 * @access  Private
 */
const updatePet = asyncHandler(async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Pet ID required' });
    }
    let pet = await Pet.findById(id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    const ownerStr = pet.owner?.toString?.() ?? '';
    const userId = req.user?._id?.toString() ?? '';
    if (ownerStr !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this pet' });
    }

    const body = req.body || {};
    const {
      name,
      species,
      breed,
      dob,
      age,
      gender,
      weight,
      medicalConditions,
      behavioralNotes,
      isVaccinated,
      medicalHistory,
      lastVetVisit,
      vaccinationStatus,
      nextVaccinationDate,
    } = body;

    if (req.file) {
      if (pet.cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(pet.cloudinaryPublicId);
        } catch (e) {
          logger.warn('Pets: delete old image failed:', e?.message ?? e);
        }
      }
      pet.photoUrl = req.file.path;
      pet.cloudinaryPublicId = req.file.filename || '';
    }

    if (name != null) pet.name = name;
    if (species != null) pet.species = species;
    if (breed !== undefined) pet.breed = breed;
    if (dob !== undefined) pet.dob = dob ? new Date(dob) : undefined;
    if (age !== undefined) pet.age = age;
    if (gender != null) pet.gender = gender;
    if (weight !== undefined) {
      const w = Number(weight);
      if (!Number.isNaN(w) && w >= 0) {
        const prevW = pet.weight == null ? null : Number(pet.weight);
        pet.weight = w;
        const changed = prevW == null || Number.isNaN(prevW) || prevW !== w;
        if (changed) {
          pushWeightHistoryEntry(pet, w, new Date(), 'owner');
        }
      }
    }
    if (medicalConditions !== undefined) pet.medicalConditions = medicalConditions;
    if (behavioralNotes !== undefined) pet.behavioralNotes = behavioralNotes;
    if (isVaccinated !== undefined) pet.isVaccinated = isVaccinated === 'true' || isVaccinated === true;

    if (medicalHistory) {
      if (typeof medicalHistory === 'string') {
        try {
          pet.medicalHistory = JSON.parse(medicalHistory);
        } catch (e) {
          pet.medicalHistory = [medicalHistory];
        }
      } else if (Array.isArray(medicalHistory)) {
        pet.medicalHistory = medicalHistory;
      }
    }
    if (lastVetVisit !== undefined) pet.lastVetVisit = lastVetVisit ? new Date(lastVetVisit) : null;
    if (vaccinationStatus !== undefined) pet.vaccinationStatus = vaccinationStatus;
    if (nextVaccinationDate !== undefined) pet.nextVaccinationDate = nextVaccinationDate ? new Date(nextVaccinationDate) : null;

    await pet.save();

    res.status(200).json({
      success: true,
      message: 'Pet updated successfully',
      data: pet,
    });
  } catch (error) {
    logger.error('Pets: update failed:', error?.message ?? error);
    res.status(500).json({
      success: false,
      message: 'Failed to update pet',
      error: error.message,
    });
  }
});

/**
 * @desc    Delete pet
 * @route   DELETE /api/v1/pets/:id
 * @access  Private
 */
const deletePet = asyncHandler(async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Pet ID required' });
    }
    const pet = await Pet.findById(id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    const ownerStr = pet.owner?.toString?.() ?? '';
    const userId = req.user?._id?.toString() ?? '';
    if (ownerStr !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this pet' });
    }

    if (pet.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(pet.cloudinaryPublicId);
      } catch (e) {
        logger.warn('Pets: delete Cloudinary image failed:', e?.message ?? e);
      }
    }

    await pet.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Pet deleted successfully',
    });
  } catch (error) {
    logger.error('Pets: delete failed:', error?.message ?? error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete pet',
      error: error.message,
    });
  }
});

/**
 * @desc    Admin creates pet for a customer
 * @route   POST /api/v1/pets/admin/:userId
 * @access  Private/Admin
 */
const adminCreatePetForCustomer = asyncHandler(async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name,
      species,
      breed,
      dob,
      age,
      gender,
      weight,
      medicalConditions,
      behavioralNotes,
      isVaccinated,
      medicalHistory,
    } = body;

    let photoUrl = '';
    let cloudinaryPublicId = '';
    if (req.file) {
      photoUrl = req.file.path || '';
      cloudinaryPublicId = req.file.filename || '';
    }

    let parsedMedicalHistory = [];
    if (medicalHistory) {
      if (typeof medicalHistory === 'string') {
        try {
          parsedMedicalHistory = JSON.parse(medicalHistory);
        } catch (e) {
          parsedMedicalHistory = [medicalHistory];
        }
      } else if (Array.isArray(medicalHistory)) {
        parsedMedicalHistory = medicalHistory;
      }
    }

    const userId = req.params?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const wnAdmin = weight !== undefined && weight !== null && weight !== '' ? Number(weight) : NaN;
    const adminInitialHistory = [];
    if (!Number.isNaN(wnAdmin) && wnAdmin >= 0) {
      adminInitialHistory.push({ recordedAt: new Date(), weightKg: wnAdmin, source: 'vet' });
    }

    const pet = await Pet.create({
      owner: userId,
      name: name ?? '',
      species: species ?? '',
      breed: breed ?? undefined,
      dob: dob ? new Date(dob) : undefined,
      age,
      gender: gender ?? '',
      weight: !Number.isNaN(wnAdmin) && wnAdmin >= 0 ? wnAdmin : weight,
      weightHistory: adminInitialHistory,
      photoUrl,
      cloudinaryPublicId,
      medicalConditions,
      behavioralNotes,
      isVaccinated: isVaccinated === 'true' || isVaccinated === true,
      medicalHistory: Array.isArray(parsedMedicalHistory) ? parsedMedicalHistory : [],
    });

    res.status(201).json({
      success: true,
      message: 'Pet created successfully for customer',
      data: pet,
    });
  } catch (error) {
    logger.error('Pets: admin create failed:', error?.message ?? error);
    res.status(500).json({
      success: false,
      message: 'Failed to create pet for customer',
      error: error.message,
    });
  }
});

module.exports = {
  createPet,
  getMyPets,
  getPetById,
  getPetHealthSummary,
  getPetMedicalHistory,
  addVetClinicalEntry,
  updatePet,
  deletePet,
  adminCreatePetForCustomer,
  getAllPets,
};
