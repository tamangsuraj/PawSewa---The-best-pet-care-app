/**
 * Unified models for pawsewa_production.
 * Use when DB_NAME=pawsewa_production.
 */
const UserUnified = require('./UserUnified');
const PetUnified = require('./PetUnified');
const ServiceUnified = require('./ServiceUnified');
const AppointmentUnified = require('./AppointmentUnified');
const OrderUnified = require('./OrderUnified');
const ChatMessageUnified = require('./ChatMessageUnified');

module.exports = {
  UserUnified,
  PetUnified,
  ServiceUnified,
  AppointmentUnified,
  OrderUnified,
  ChatMessageUnified,
};
