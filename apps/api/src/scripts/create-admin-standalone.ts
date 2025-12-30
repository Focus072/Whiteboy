import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  try {
    console.log('Create Admin User');
    console.log('================\n');

    const email = await question('Email: ');
    if (!email || !email.includes('@')) {
      console.error('Invalid email address');
      process.exit(1);
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.error(`User with email ${email} already exists`);
      process.exit(1);
    }

    const password = await question('Password: ');
    if (!password || password.length < 8) {
      console.error('Password must be at least 8 characters');
      process.exit(1);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'ADMIN',
      },
    });

    console.log(`\n✓ Admin user created successfully!`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);

    // Audit log
    await prisma.auditEvent.create({
      data: {
        actorType: 'SYSTEM',
        action: 'CREATE_ADMIN_USER',
        entityType: 'USER',
        entityId: user.id,
        result: 'SUCCESS',
      },
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();

