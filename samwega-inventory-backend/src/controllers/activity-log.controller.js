const activityLogService = require('../services/activity-log.service');
const { successResponse } = require('../utils/response');

class ActivityLogController {
    /**
     * Get activity logs
     * GET /api/v1/activity-logs
     */
    async getLogs(req, res, next) {
        try {
            const options = {
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0,
                userId: req.query.userId,
                action: req.query.action,
                resource: req.query.resource,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            const logs = await activityLogService.getLogs(options);

            res.json(successResponse(
                logs,
                'Activity logs retrieved successfully',
                { count: logs.length }
            ));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ActivityLogController();
