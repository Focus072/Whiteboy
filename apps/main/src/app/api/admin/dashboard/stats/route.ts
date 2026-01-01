/**
 * Get dashboard statistics
 * GET /api/admin/dashboard/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, OrderStatus } from '@lumi/db';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Order counts by status
    const [paidCount, shippedCount, blockedCount, totalOrders] = await Promise.all([
      prisma.order.count({ where: { status: OrderStatus.PAID } }),
      prisma.order.count({ where: { status: OrderStatus.SHIPPED } }),
      prisma.order.count({ where: { status: OrderStatus.BLOCKED } }),
      prisma.order.count(),
    ]);

    // Revenue calculations
    const [todayRevenue, weekRevenue, monthRevenue, totalRevenue] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: OrderStatus.SHIPPED,
          shippedAt: { gte: startOfToday },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          status: OrderStatus.SHIPPED,
          shippedAt: { gte: startOfWeek },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          status: OrderStatus.SHIPPED,
          shippedAt: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { status: OrderStatus.SHIPPED },
        _sum: { totalAmount: true },
      }),
    ]);

    // Product counts
    const [activeProducts, totalProducts] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.product.count(),
    ]);

    // Recent orders (last 10)
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: {
          select: {
            state: true,
          },
        },
      },
    });

    // Orders by status for chart
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    // Orders by day (last 30 days) for chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ordersByDay = await prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
        totalAmount: true,
        status: true,
      },
    });

    // Group by day
    const dailyStats = ordersByDay.reduce((acc: any, order) => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, count: 0, revenue: 0 };
      }
      acc[date].count++;
      if (order.status === OrderStatus.SHIPPED) {
        acc[date].revenue += Number(order.totalAmount);
      }
      return acc;
    }, {});

    const dailyStatsArray = Object.values(dailyStats).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      success: true,
      data: {
        orders: {
          paid: paidCount,
          shipped: shippedCount,
          blocked: blockedCount,
          total: totalOrders,
          byStatus: ordersByStatus.map((item) => ({
            status: item.status,
            count: item._count,
          })),
        },
        revenue: {
          today: Number(todayRevenue._sum.totalAmount || 0),
          week: Number(weekRevenue._sum.totalAmount || 0),
          month: Number(monthRevenue._sum.totalAmount || 0),
          total: Number(totalRevenue._sum.totalAmount || 0),
          daily: dailyStatsArray,
        },
        products: {
          active: activeProducts,
          total: totalProducts,
        },
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          status: order.status,
          totalAmount: Number(order.totalAmount),
          createdAt: order.createdAt,
          itemCount: order.items.length,
          state: order.shippingAddress?.state,
        })),
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
