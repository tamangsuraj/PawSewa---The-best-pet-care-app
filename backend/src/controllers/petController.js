const asyncHandler = require('express-async-handler');
const Pet = require('../models/Pet');
const cloudinary = require('../config/cloudinary');

/**
 * @desc    Create a new pet
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

    const pet = await Pet.create({
      owner: req.user._id,
      name: name ?? '',
      species: species ?? '',
      breed: breed ?? undefined,
      dob: dob ? new Date(dob) : undefined,
      age,
      gender: gender ?? '',
      weight,
      photoUrl,
      cloudinaryPublicId,
      medicalConditions,
      behavioralNotes,
      isVaccinated: isVaccinated === 'true' || isVaccinated === true,
      medicalHistory: Array.isArray(parsedMedicalHistory) ? parsedMedicalHistory : [],
    });

    res.status(201).json({
      success: true,
      message: 'Pet created successfully',
      data: pet,
    });
  } catch (error) {
    console.error('SERVER CRASH:', error);
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
    console.log('[Pets] /api/v1/pets/my-pets request at', new Date().toISOString(), 'user:', req.user._id.toString());

    const pets = await Pet.find({ owner: req.user._id })
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
    console.error('SERVER CRASH:', error);
    return res.status(200).json({
      success: true,
      count: 0,
      data: [],
    });
  }
});

/**
 * @desc    Get all pets (admin) with optional search by name, species, breed, or pawId
 * @route   GET /api/v1/pets/admin
 * @access  Private/Admin
 */
const getAllPets = asyncHandler(async (req, res) => {
  try {
    const { search } = req.query || {};
    const filter = {};

    if (search && typeof search === 'string') {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { name: regex },
        { species: regex },
        { breed: regex },
        { pawId: regex },
      ];
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
    console.error('SERVER CRASH:', error);
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
    res.status(200).json({
      success: true,
      data: pet,
    });
  } catch (error) {
    console.error('SERVER CRASH:', error);
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
    } = body;

    if (req.file) {
      if (pet.cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(pet.cloudinaryPublicId);
        } catch (e) {
          console.error('Error deleting old image:', e);
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
    if (weight !== undefined) pet.weight = weight;
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

    await pet.save();

    res.status(200).json({
      success: true,
      message: 'Pet updated successfully',
      data: pet,
    });
  } catch (error) {
    console.error('SERVER CRASH:', error);
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
        console.error('Error deleting image from Cloudinary:', e);
      }
    }

    await pet.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Pet deleted successfully',
    });
  } catch (error) {
    console.error('SERVER CRASH:', error);
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

    const pet = await Pet.create({
      owner: userId,
      name: name ?? '',
      species: species ?? '',
      breed: breed ?? undefined,
      dob: dob ? new Date(dob) : undefined,
      age,
      gender: gender ?? '',
      weight,
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
    console.error('SERVER CRASH:', error);
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
  updatePet,
  deletePet,
  adminCreatePetForCustomer,
   getAllPets,
};
