import { getReturnsService } from '../../services/admin/returnService.js';

export const getReturnsPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const { returns, stats, totalPages, totalReturns } = await getReturnsService(search, status, page, limit);

        // Build query string for pagination
        let queryString = '';
        if (search) queryString += `search=${search}&`;
        if (status) queryString += `status=${status}&`;

        res.render('admin/returns', {
            title: 'Return Management',
            returns,
            stats,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            lastPage: totalPages,
            search,
            status,
            query: queryString,
            totalReturns,
            breadcrumbs: [
                { label: 'Orders', url: '/admin/orders' },
                { label: 'Returns', url: '/admin/returns' }
            ]
        });
    } catch (error) {
        console.error('Error fetching return management page:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};
