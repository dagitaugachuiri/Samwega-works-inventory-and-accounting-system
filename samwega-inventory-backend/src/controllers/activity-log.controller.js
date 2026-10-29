const activityLogService = require('../services/activity-log.service');

class ActivityLogController {
    /**
     * Get activity logs
     * GET /api/v1/activity-logs
     */
    async getLogs(req, res, next) {
        try {
            const result = await activityLogService.getLogs({
                page: req.query.page,
                limit: req.query.limit,
                search: req.query.search,
                userId: req.query.userId,
                action: req.query.action,
                resource: req.query.resource,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            });

            res.json({
                success: true,
                message: 'Activity logs retrieved successfully',
                data: result.logs,
                pagination: result.pagination,
                truncated: result.truncated,
                since: result.since
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ActivityLogController();
