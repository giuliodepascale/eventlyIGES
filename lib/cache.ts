import { cache } from 'react';
import { getUserById } from '@/data/user';
import { getEventById } from '@/data/event';

export const getUserByIdCached = cache(getUserById);
export const getEventByIdCached = cache(getEventById);
