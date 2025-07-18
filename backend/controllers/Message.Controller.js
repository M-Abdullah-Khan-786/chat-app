const Message = require("../models/Message.Schema");
const User = require("../models/User.Schema");
const { default: cloudinary } = require("../lib/cloudinary");
const { io, userSocketMap } = require("../app");

// Get all users except the looged in user
const getAllUsers = async (req, res) => {
  try {
    const { _id } = req.user;
    const filterUsers = await User.find({ _id: { $ne: _id } }).select(
      "-password"
    );
    const unSeenMessages = {};
    const promises = filterUsers.map(async (user) => {
      const unSeen = await Message.find({
        senderId: user._id,
        receiverId: _id,
        seen: false,
      });
      if (unSeen.length > 0) {
        unSeenMessages[user._id] = unSeen.length;
      }
    });
    await Promise.all(promises);
    return res.status(200).json({
      success: true,
      message: "Message retrieved successfully",
      user: filterUsers,
      messages: unSeenMessages,
    });
  } catch (error) {
    console.error(error);
  }
};

// Get all messages for selected user
const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const { _id } = req.user;
    const messages = await Message.find({
      $or: [
        { senderId: _id, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: _id },
      ],
    });
    await Message.updateMany(
      { senderId: selectedUserId, receiverId: _id },
      { seen: true }
    );
    return res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      messages: messages,
    });
  } catch (error) {
    console.error(error);
  }
};

// Mark message as seen using message id
const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.updateOne({ _id: id }, { seen: true });
    return res.status(200).json({
      success: true,
      message: "Message marked as seen successfully",
    });
  } catch (error) {
    console.error(error);
  }
};

// Send message to user
const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const { _id } = req.user;

    let imageUrl;
    if (image) {
      const response = await cloudinary.uploader.upload(image);
      imageUrl = response.secure_url;
    }
    const newMessage = new Message.create({
      senderId: _id,
      receiverId,
      text,
      image: imageUrl,
    });
    await newMessage.save();

    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      newMessage: newMessage,
    });
  } catch (error) {
    console.error(error);
  }
};

module.exports = { getAllUsers, getMessages, markMessageAsSeen, sendMessage };
