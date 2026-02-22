/**
 * Unified Chat Message model for pawsewa_production.
 * Collection: chat_messages
 * All communication linked by conversationId.
 */
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserUnified', required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true, collection: 'chat_messages' }
);

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessageUnified', chatMessageSchema);
