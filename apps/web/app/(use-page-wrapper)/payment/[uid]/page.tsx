import { APP_NAME } from "@calcom/lib/constants";
import { buildLegacyCtx } from "@lib/buildLegacyCtx";
import type { PageProps } from "app/_types";
import { _generateMetadata } from "app/_utils";
import { withAppDirSsr } from "app/WithAppDirSsr";
import { cookies, headers } from "next/headers";
import PaymentPage from "./PaymentPage";
import prisma from "@calcom/prisma";

type PaymentPageProps = {
  payment: {
    id: number;
    success: boolean;
    refunded: boolean;
    amount: number;
    currency: string;
    paymentOption: string | null;
    data: Record<string, unknown>;
    appId?: string | null;
  };
  clientSecret?: string | null;
  booking: {
    id: number;
    uid: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    paid: boolean;
    description?: string | null;
    location?: string | null;
  };
  eventType: {
    id: number;
    title: string;
    length: number;
    price: number;
    currency: string;
    metadata: Record<string, unknown> | null;
    successRedirectUrl?: string | null;
    forwardParamsSuccessRedirect?: boolean | null;
    recurringEvent?: unknown;
  };
  profile: { theme?: string | null; hideBranding?: boolean };
  user?: { name?: string | null; username?: string | null } | null;
};

export const generateMetadata = async ({ params, searchParams }: PageProps) => {
  const props = await getData(
    buildLegacyCtx(await headers(), await cookies(), await params, await searchParams)
  );
  const eventName = props.booking.title;
  return await _generateMetadata(
    (t) => `${t("payment")} | ${eventName} | ${APP_NAME}`,
    () => "",
    undefined,
    undefined,
    `/payment/${(await params).uid}`
  );
};

const getData = withAppDirSsr<PaymentPageProps>(async (ctx) => {
  const paymentUid = ctx.params?.paymentId || ctx.params?.uid;

  if (!paymentUid || typeof paymentUid !== "string") {
    throw new Error("Payment UID not provided");
  }

  // 1. Buscamos el pago y traemos la relación con booking y eventType
  const payment = await prisma.payment.findUnique({
    where: { uid: paymentUid },
    select: {
      id: true,
      amount: true,
      currency: true,
      success: true,
      refunded: true,
      paymentOption: true,
      data: true,
      appId: true,
      booking: {
        select: {
          id: true,
          uid: true,
          title: true,
          startTime: true,
          endTime: true,
          status: true,
          paid: true,
          location: true,
          description: true,
          eventType: {
            select: {
              id: true,
              title: true,
              length: true,
              price: true,
              currency: true,
              metadata: true,
            },
          },
        },
      },
    },
  });

  if (!payment || !payment.booking) {
    throw new Error("Payment or Booking not found");
  }

  const booking = payment.booking;
  const eventType = booking.eventType;

  // 2. Retornamos las props reales hacia el front-end
  return {
    props: {
      payment: {
        id: payment.id,
        success: payment.success,
        refunded: payment.refunded,
        amount: payment.amount,
        currency: payment.currency,
        paymentOption: payment.paymentOption,
        data: (payment.data as Record<string, unknown>) || {},
        appId: payment.appId,
      },
      booking: {
        id: booking.id,
        uid: booking.uid,
        title: booking.title || eventType?.title || "Reserva de cita",
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
        paid: booking.paid,
        location: booking.location,
        description: booking.description,
      },
      eventType: {
        id: eventType?.id || 0,
        title: eventType?.title || booking.title || "",
        length: eventType?.length || 30, // Si no hay eventType, usa 30 mins por defecto
        price: eventType?.price || payment.amount,
        currency: eventType?.currency || payment.currency,
        metadata: (eventType?.metadata as Record<string, unknown>) || null,
      },
      profile: { theme: null, hideBranding: false },
    },
  };
});

const ServerPage = async ({ params, searchParams }: PageProps) => {
  const props = await getData(
    buildLegacyCtx(await headers(), await cookies(), await params, await searchParams)
  );

  return <PaymentPage {...props} />;
};
export default ServerPage;
