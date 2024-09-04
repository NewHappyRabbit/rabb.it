import 'dotenv/config';
import { afterAll, describe, expect, test } from 'vitest'
import { mongoConfig } from '../config/database.js'
import { setEnvVariables } from './common.js';
import { User } from '../models/user.js';
import { UserController } from '../controllers/users.js';

setEnvVariables();
await mongoConfig();

afterAll(async () => {
    await User.deleteMany({});
});

let userId, adminId;
describe('POST /users', () => {
    test('Create user', async () => {
        const data = {
            username: 'user1',
            password: '123456',
            password2: '123456',
            role: 'user'
        };

        const { status } = await UserController.post(data);
        expect(status).toBe(201);
        const user = await User.findOne({ username: 'user1' });
        expect(user._id).toBeDefined();
        expect(user.role).toBe('user');
        userId = user._id;
    });

    test('Create admin', async () => {
        const data = {
            username: 'admin1',
            password: '123456',
            password2: '123456',
            role: 'admin'
        };

        const { status } = await UserController.post(data);
        expect(status).toBe(201);
        const user = await User.findOne({ username: 'admin1' });
        expect(user._id).toBeDefined();
        expect(user.role).toBe('admin');
        adminId = user._id;
    });

    describe('Validate data', () => {
        test('Password is less than 6 symbols', async () => {
            const data = {
                username: 'test',
                password: 'test',
                password2: 'test',
                role: 'user'
            };
            const { status, message } = await UserController.post(data);
            expect(status).toBe(400);
            expect(message).toBe('Паролата трябва да е поне 6 символа');
        });

        test('No username', async () => {
            const data = {
                password: 'test',
                password2: 'test',
                role: 'user'
            }
            const { status, message } = await UserController.post(data);
            expect(status).toBe(400);
            expect(message).toBe('Липсва потребителско име');
        });

        test('Passwords are not the same', async () => {
            const data = {
                username: 'test',
                password: 'test123',
                password2: 'test1234',
                role: 'user'
            }
            const { status, message } = await UserController.post(data);
            expect(status).toBe(400);
            expect(message).toBe('Паролите не съвпадат');
        });

        test('No role', async () => {
            const data = {
                username: 'test',
                password: 'test123',
                password2: 'test123',
            }
            const { status, message } = await UserController.post(data);
            expect(status).toBe(400);
            expect(message).toBe('Грешка при избора на роля');
        });

        test('Non-existing role', async () => {
            const data = {
                username: 'test',
                password: 'test123',
                password2: 'test123',
                role: 'asd'
            }
            const { status, message } = await UserController.post(data);
            expect(status).toBe(400);
            expect(message).toBe('Грешка при избора на роля');
        });

        test('User already exists', async () => {
            const data = {
                username: 'user1',
                password: '123456',
                password2: '123456',
                role: 'user'
            }

            const { status, message } = await UserController.post(data);
            expect(status).toBe(400);
            expect(message).toBe('Потребител с това име вече съществува');
        });
    });
});

test('GET /users', async () => {
    const users = await UserController.get();
    expect(users.length).toEqual(2);
});

test('GET by id', async () => {
    const user = await UserController.getById(userId);
    expect(user._id.toString()).toEqual(userId.toString());
    expect(user.username).toEqual('user1');
});

test('Get user roles', () => {
    const roles = UserController.getRoles();
    expect(Object.keys(roles)).toContain('admin');
    expect(Object.keys(roles)).toContain('manager');
    expect(Object.keys(roles)).toContain('user');
})

describe('PUT /users/:id', () => {
    test('Update user', async () => {
        const data = {
            id: userId,
            username: 'user2',
            password: '123123',
            password2: '123123',
            role: 'admin'
        };

        const { status } = await UserController.put(data);
        expect(status).toBe(201);

        const user = await User.findById(userId);
        expect(user.role).toBe('admin');
        expect(user.username).toBe('user2');
    });

    describe('Validate data', () => {
        test('User not found', async () => {
            const data = {
                username: 'user2',
                password: '123123',
                password2: '123123',
                role: 'admin'
            };

            const { status, message } = await UserController.put(data);
            expect(status).toBe(404);
            expect(message).toBe('Потребителят не е намерен');
        });

        test('No username', async () => {
            const data = {
                id: userId,
                password: '123123',
                password2: '123123',
                role: 'admin'
            }

            const { status, message } = await UserController.put(data);
            expect(status).toBe(400);
            expect(message).toBe('Липсва потребителско име');
        });

        test('Username already exists', async () => {
            const data = {
                id: userId,
                username: 'admin1',
                password: '123123',
                password2: '123123',
                role: 'admin'
            }

            const { status, message } = await UserController.put(data);
            expect(status).toBe(400);
            expect(message).toBe('Потребител с това име вече съществува');
        });

        test('Password is less than 6 symbols', async () => {
            const data = {
                id: userId,
                username: 'user2',
                password: '123',
                password2: '123',
                role: 'admin'
            }

            const { status, message } = await UserController.put(data);
            expect(status).toBe(400);
            expect(message).toBe('Паролата трябва да е поне 6 символа');
        });

        test('Passwords are not the same', async () => {
            const data = {
                id: userId,
                username: 'user2',
                password: '123123',
                password2: '1231234',
                role: 'admin'
            }

            const { status, message } = await UserController.put(data);
            expect(status).toBe(400);
            expect(message).toBe('Паролите не съвпадат');
        });

        test('No role', async () => {
            const data = {
                id: userId,
                username: 'user2',
                password: '123123',
                password2: '123123',
            }

            const { status, message } = await UserController.put(data);
            expect(status).toBe(400);
            expect(message).toBe('Грешка при избора на роля');
        });

        test('Non-existing role', async () => {
            const data = {
                id: userId,
                username: 'user2',
                password: '123123',
                password2: '123123',
                role: 'asd'
            }

            const { status, message } = await UserController.put(data);
            expect(status).toBe(400);
            expect(message).toBe('Грешка при избора на роля');
        });
    });
});

describe('DELETE /users/:id', () => {
    test('Delete user', async () => {
        const { status } = await UserController.delete(userId);
        expect(status).toBe(204);

        const user = await User.findById(userId);
        expect(user).toBe(null);
    });

    test('User not found', async () => {
        const { status, message } = await UserController.delete(userId);
        expect(status).toBe(404);
        expect(message).toBe('Потребителят не е намерен');
    });
});

describe('Login', () => {
    test('No username', async () => {
        const data = {
            username: '',
            password: '123123'
        };

        const { status, message } = await UserController.login(data);
        expect(status).toBe(400);
        expect(message).toBe('Въведете потребителско име');
    });

    test('No password', async () => {
        const data = {
            username: 'admin',
            password: ''
        };

        const { status, message } = await UserController.login(data);
        expect(status).toBe(400);
        expect(message).toBe('Въведете парола');
    });

    test('No user found', async () => {
        const data = {
            username: 'asdasd',
            password: '123123'
        }

        const { status, message } = await UserController.login(data);
        expect(status).toBe(404);
        expect(message).toBe('Потребителят не е намерен');
    });

    test('Wrong password', async () => {
        const data = {
            username: 'admin1',
            password: '123123123'
        }

        const { status, message } = await UserController.login(data);
        expect(status).toBe(401);
        expect(message).toBe('Грешна парола');
    });

    test('Success', async () => {
        const data = {
            username: 'admin1',
            password: '123456'
        };

        const { status, token, maxAge, id, username, role } = await UserController.login(data);

        expect(status).toBe(200);
        expect(maxAge).toBe(12 * 60 * 60);
        expect(id.toString()).toBe(adminId.toString());
        expect(username).toBe('admin1');
        expect(role).toBe('admin');
        expect(token).toBeDefined();
    });
});

await User.deleteMany({});