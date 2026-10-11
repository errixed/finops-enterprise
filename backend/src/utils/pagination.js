export function parsePagination(page = 1, pageSize = 10) {
    const currentPage = Number(page);
    const currentPageSize = Number(pageSize);

    if (
        !Number.isInteger(currentPage) ||
        currentPage < 1 ||
        !Number.isInteger(currentPageSize) ||
        currentPageSize < 1 ||
        currentPageSize > 100
    ) {
        const error = new Error("Invalid pagination parameters");
        error.statusCode = 400;
        throw error;
    }

    return {
        page: currentPage,
        pageSize: currentPageSize
    };
}

export function paginate(items, page = 1, pageSize = 10) {
    const pagination = parsePagination(page, pageSize);
    const start = (pagination.page - 1) * pagination.pageSize;

    return {
        data: items.slice(start, start + pagination.pageSize),
        pagination: {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: items.length,
            totalPages: Math.ceil(items.length / pagination.pageSize)
        }
    };
}