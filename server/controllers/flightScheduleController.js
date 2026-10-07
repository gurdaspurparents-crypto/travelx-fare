const flightScheduleService = require('../services/flightScheduleService');
const publicAgentController = require('./publicAgentController');

exports.getSchedules = (req, res) => {
  try {
    const filter = {
      origin: req.query.origin,
      destination: req.query.destination,
      flight_number: req.query.flight_number,
      active_only: req.query.active_only === '1'
    };
    const data = flightScheduleService.getAllSchedules(filter);
    res.json({
      success: true,
      schedules: data.schedules,
      operatingFlights: data.operatingFlights
    });
  } catch (err) {
    console.error('Error in getSchedules:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.upsertSchedule = (req, res) => {
  try {
    const result = flightScheduleService.upsertSchedule(req.body);
    publicAgentController.invalidateFaresCache();
    res.json({
      success: true,
      message: 'Flight schedule saved and live rates synced successfully.',
      result
    });
  } catch (err) {
    console.error('Error in upsertSchedule:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteSchedule = (req, res) => {
  try {
    const id = req.params.id;
    const result = flightScheduleService.deleteSchedule(id);
    publicAgentController.invalidateFaresCache();
    res.json({
      success: true,
      message: 'Flight schedule deleted.',
      result
    });
  } catch (err) {
    console.error('Error in deleteSchedule:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.parseScheduleText = (req, res) => {
  try {
    const text = req.body.text || '';
    const parsed = flightScheduleService.parseAirlineScheduleText(text);
    res.json({
      success: true,
      count: parsed.length,
      parsed
    });
  } catch (err) {
    console.error('Error in parseScheduleText:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.bulkSaveSchedules = (req, res) => {
  try {
    const list = Array.isArray(req.body.schedules) ? req.body.schedules : [];
    if (list.length === 0) {
      return res.status(400).json({ success: false, error: 'No schedules provided' });
    }

    let saved = 0;
    const errors = [];
    list.forEach((item, idx) => {
      try {
        flightScheduleService.upsertSchedule(item);
        saved++;
      } catch (e) {
        errors.push({ index: idx, error: e.message });
      }
    });

    publicAgentController.invalidateFaresCache();
    res.json({
      success: true,
      saved_count: saved,
      errors_count: errors.length,
      errors: errors.slice(0, 5),
      message: `Successfully saved ${saved} flight schedules!`
    });
  } catch (err) {
    console.error('Error in bulkSaveSchedules:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.syncLiveAirlines = (req, res) => {
  try {
    const result = flightScheduleService.syncWithLiveAirlines();
    publicAgentController.invalidateFaresCache();
    res.json({
      success: true,
      message: 'Live airline schedules refreshed and synced across all portal rates.',
      ...result
    });
  } catch (err) {
    console.error('Error in syncLiveAirlines:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.applyToFares = (req, res) => {
  try {
    const count = flightScheduleService.applySchedulesToFares();
    publicAgentController.invalidateFaresCache();
    res.json({
      success: true,
      updated_count: count,
      message: `Applied latest airline flight timings to ${count} active fares.`
    });
  } catch (err) {
    console.error('Error in applyToFares:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
