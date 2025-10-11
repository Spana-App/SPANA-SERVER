const Service = require('../models/Service');

// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();
    const find: any = {};
    if (q) {
      find.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { category: new RegExp(q, 'i') }
      ];
    }
    if (category) find.category = category;
    const services = await Service.find(find).populate('provider', 'firstName lastName rating profileImage');
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export {};

// Get service by ID
exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate('provider', 'firstName lastName rating profileImage');
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new service
exports.createService = async (req, res) => {
  try {
    const { title, description, category, price, duration, mediaUrl, status } = req.body;

    const service = new Service({
      title,
      description,
      category,
      price,
      duration,
      provider: req.user.id,
      mediaUrl,
      status
    });

    await service.save();
    await service.populate('provider', 'firstName lastName rating profileImage');
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a service
exports.updateService = async (req, res) => {
  try {
    const { title, description, category, price, duration, mediaUrl, status } = req.body;
    let service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the provider or an admin
    if (service.provider.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    service = await Service.findByIdAndUpdate(
      req.params.id,
      { title, description, category, price, duration, mediaUrl, status },
      { new: true }
    ).populate('provider', 'firstName lastName rating profileImage');

    res.json(service);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the provider or an admin
    if (service.provider.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: 'Service removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get services by category
exports.getServicesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const services = await Service.find({ category }).populate('provider', 'firstName lastName rating profileImage');
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};