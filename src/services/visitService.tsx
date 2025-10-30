import { apiRequest } from '../lib/api';

export const visitService = {
    async getVisit(id?: string) {
        const url = id ? `/visits/${id}` : '/visits';

        return apiRequest(url, { method: 'GET' });

    }
};
