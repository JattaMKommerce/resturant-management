const operationsService = require('../../services/kot/operationsService');
const { sendSuccess, sendError } = require('../../utils/response');

async function getOverview(req, res, next) {
  try {
    const restaurantId = req.user?.restaurant_id || 1;
    const data = await operationsService.getOperationsOverview(restaurantId);
    return sendSuccess(res, data, 'Operations overview fetched successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview
};
