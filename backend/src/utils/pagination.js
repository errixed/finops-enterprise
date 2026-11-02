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