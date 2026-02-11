const asyncHandler = require('express-async-handler');
const Pet = require('../models/Pet');
const cloudinary = require('../config/cloudinary');

/**
 * @desc    Create a new pet
 * @route   POST /api/v1/pets
 * @access  Private
 */
const createPet = asyncHandler(async (req, res) => {
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
    medicalHistory 
  } = req.body;

  // Check if image was uploaded
  let photoUrl = '';
  let cloudinaryPublicId = '';

  if (req.file) {
    photoUrl = req.file.path;
    cloudinaryPublicId = req.file.filename;
  }

  // Parse medicalHistory if it's a string
  let parsedMedicalHistory = [];
  if (medicalHistory) {
    if (typeof medicalHistory === 'string') {
      try {
        parsedMedicalHistory = JSON.parse(medicalHistory);
      } catch (error) {
        parsedMedicalHistory = [medicalHistory];
      }
    } else if (Array.isArray(medicalHistory)) {
      parsedMedicalHistory = medicalHistory;
    }
  }

  const pet = await Pet.create({
    owner: req.user._id,
    name,
    species,
    breed,
    dob: dob ? new Date(dob) : undefined,
    age,
    gender,
    weight,
    photoUrl,
    cloudinaryPublicId,
    medicalConditions,
    behavioralNotes,
    isVaccinated: isVaccinated === 'true' || isVaccinated === true,
    medicalHistory: parsedMedicalHistory,
  });

  res.status(201).json({
    success: true,
    message: 'Pet created successfully',
    data: pet,
  });
});

/**
 * @desc    Get all pets for logged-in user
 * @route   GET /api/v1/pets/my-pets
 * @access  Private
 */
const getMyPets = asyncHandler(async (req, res) => {
  console.log('[Pets] /api/v1/pets/my-pets request at', new Date().toISOString(), 'user:', req.user?._id?.toString());
  const pets = await Pet.find({ owner: req.user._id }).sort({ createdAt: -1 });

  res.json({
    success: true,
    count: pets.length,
    data: pets,
  });
});

/**
 * @desc    Get single pet by ID
 * @route   GET /api/v1/pets/:id
 * @access  Private
 */
const getPetById = asyncHandler(async (req, res) => {
  const pet = await Pet.findById(req.params.id).populate('owner', 'name email');

  if (!pet) {
    res.status(404);
    throw new Error('Pet not found');
  }

  // Check if user owns this pet or is admin
  if (pet.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to access this pet');
  }

  res.json({
    success: true,
    data: pet,
  });
});

/**
 * @desc    Update pet
 * @route   PUT /api/v1/pets/:id
 * @access  Private
 */
const updatePet = asyncHandler(async (req, res) => {
  let pet = await Pet.findById(req.params.id);

  if (!pet) {
    res.status(404);
    throw new Error('Pet not found');
  }

  // Check if user owns this pet
  if (pet.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to update this pet');
  }

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
    medicalHistory 
  } = req.body;

  // Handle new image upload
  if (req.file) {
    // Delete old image from Cloudinary if exists
    if (pet.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(pet.cloudinaryPublicId);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }

    pet.photoUrl = req.file.path;
    pet.cloudinaryPublicId = req.file.filename;
  }

  // Update fields
  if (name) pet.name = name;
  if (species) pet.species = species;
  if (breed !== undefined) pet.breed = breed;
  if (dob !== undefined) pet.dob = dob ? new Date(dob) : undefined;
  if (age !== undefined) pet.age = age;
  if (gender) pet.gender = gender;
  if (weight !== undefined) pet.weight = weight;
  if (medicalConditions !== undefined) pet.medicalConditions = medicalConditions;
  if (behavioralNotes !== undefined) pet.behavioralNotes = behavioralNotes;
  if (isVaccinated !== undefined) pet.isVaccinated = isVaccinated === 'true' || isVaccinated === true;

  // Parse medicalHistory if provided
  if (medicalHistory) {
    if (typeof medicalHistory === 'string') {
      try {
        pet.medicalHistory = JSON.parse(medicalHistory);
      } catch (error) {
        pet.medicalHistory = [medicalHistory];
      }
    } else if (Array.isArray(medicalHistory)) {
      pet.medicalHistory = medicalHistory;
    }
  }

  await pet.save();

  res.json({
    success: true,
    message: 'Pet updated successfully',
    data: pet,
  });
});

/**
 * @desc    Delete pet
 * @route   DELETE /api/v1/pets/:id
 * @access  Private
 */
const deletePet = asyncHandler(async (req, res) => {
  const pet = await Pet.findById(req.params.id);

  if (!pet) {
    res.status(404);
    throw new Error('Pet not found');
  }

  // Check if user owns this pet
  if (pet.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this pet');
  }

  // Delete image from Cloudinary if exists
  if (pet.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(pet.cloudinaryPublicId);
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
    }
  }

  await pet.deleteOne();

  res.json({
    success: true,
    message: 'Pet deleted successfully',
  });
});

/**
 * @desc    Admin creates pet for a customer
 * @route   POST /api/v1/pets/admin/:userId
 * @access  Private/Admin
 */
const adminCreatePetForCustomer = asyncHandler(async (req, res) => {
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
    medicalHistory 
  } = req.body;

  // Check if image was uploaded
  let photoUrl = '';
  let cloudinaryPublicId = '';

  if (req.file) {
    photoUrl = req.file.path;
    cloudinaryPublicId = req.file.filename;
  }

  // Parse medicalHistory if it's a string
  let parsedMedicalHistory = [];
  if (medicalHistory) {
    if (typeof medicalHistory === 'string') {
      try {
        parsedMedicalHistory = JSON.parse(medicalHistory);
      } catch (error) {
        parsedMedicalHistory = [medicalHistory];
      }
    } else if (Array.isArray(medicalHistory)) {
      parsedMedicalHistory = medicalHistory;
    }
  }

  const pet = await Pet.create({
    owner: req.params.userId,
    name,
    species,
    breed,
    dob: dob ? new Date(dob) : undefined,
    age,
    gender,
    weight,
    photoUrl,
    cloudinaryPublicId,
    medicalConditions,
    behavioralNotes,
    isVaccinated: isVaccinated === 'true' || isVaccinated === true,
    medicalHistory: parsedMedicalHistory,
  });

  res.status(201).json({
    success: true,
    message: 'Pet created successfully for customer',
    data: pet,
  });
});

module.exports = {
  createPet,
  getMyPets,
  getPetById,
  updatePet,
  deletePet,
  adminCreatePetForCustomer,
};
