const express = require('express');
const router = express.Router();
const kotController = require('../../controllers/kot/kotController');
const { authenticateToken } = require('../../middleware/kotAuth');

router.use(authenticateToken);

router.get('/', kotController.getKOTs);
router.get('/:id', kotController.getKOTById);
router.patch('/:id/status', kotController.updateKOTStatusHandler);
router.patch('/items/:itemId/status', kotController.updateKOTItemStatus);

module.exports = router;
