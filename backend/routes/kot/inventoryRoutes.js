const express = require('express');
const router = express.Router();
const recipeInventoryController = require('../../controllers/kot/recipeInventoryController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);

router.get('/items', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getInventoryItems);
router.post('/items', requireRoles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER'), recipeInventoryController.createInventoryItem);
router.get('/recipes', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getRecipes);
router.post('/recipes', requireRoles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER'), recipeInventoryController.createOrUpdateRecipe);
router.get('/transactions', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getStockTransactions);
router.get('/availability', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getIngredientAvailabilityHandler);

// Expiry Management & Batches
router.get('/batches', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getInventoryBatches);
router.post('/batches', requireRoles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER'), recipeInventoryController.createInventoryBatch);
router.put('/batches/:id', requireRoles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER'), recipeInventoryController.updateInventoryBatch);
router.delete('/batches/:id', requireRoles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER'), recipeInventoryController.deleteInventoryBatch);

router.get('/expiry-dashboard', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getExpiryDashboardData);
router.get('/expiry-report', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getExpiryReportData);

router.get('/suppliers', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getSuppliers);
router.post('/suppliers', requireRoles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER'), recipeInventoryController.createSupplier);

// Inventory Intelligence & Smart Insights
router.get('/intelligence', requireRoles('ADMIN', 'MANAGER'), recipeInventoryController.getInventoryIntelligence);
router.get('/kitchen-intelligence', requireRoles('ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER'), recipeInventoryController.getKitchenIntelligence);

module.exports = router;
