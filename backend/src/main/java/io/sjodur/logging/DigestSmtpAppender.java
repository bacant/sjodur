package io.sjodur.logging;

import ch.qos.logback.classic.net.SMTPAppender;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.boolex.EvaluationException;
import ch.qos.logback.core.helpers.CyclicBuffer;
import ch.qos.logback.core.util.Duration;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * SMTP appender that sends digests instead of one mail per error.
 *
 * The first event the evaluator accepts (ERROR by default) starts a timer; everything that
 * arrives within {@code interval} goes into the same mail, at most {@code maxEvents} of them
 * (older ones are dropped and counted). During an outage that means one mail every five
 * minutes rather than hundreds, and a lonely error still arrives within five minutes.
 *
 * Transport, session and layout are Logback's own (SMTPAppender), so smtpHost, smtpPort,
 * username/password, ssl/starttls, to, from and subject are configured exactly as documented
 * for SMTPAppender. Needs Jakarta Mail on the classpath (spring-boot-starter-mail).
 *
 * Configuration (logback-spring.xml):
 * <pre>
 *   &lt;appender name="EMAIL" class="io.sjodur.logging.DigestSmtpAppender"&gt;
 *     &lt;interval&gt;5 minutes&lt;/interval&gt;
 *     &lt;maxEvents&gt;50&lt;/maxEvents&gt;
 *     ... smtpHost, to, from, subject, layout as for SMTPAppender ...
 *   &lt;/appender&gt;
 * </pre>
 */
public class DigestSmtpAppender extends SMTPAppender {

    private Duration interval = Duration.buildByMinutes(5);
    private int maxEvents = 50;

    private CyclicBuffer<ILoggingEvent> pending = new CyclicBuffer<>(maxEvents);
    private ScheduledFuture<?> scheduledFlush;
    private int dropped;

    public void setInterval(Duration interval) {
        this.interval = interval;
    }

    public void setMaxEvents(int maxEvents) {
        this.maxEvents = Math.max(1, maxEvents);
    }

    @Override
    public void start() {
        pending = new CyclicBuffer<>(maxEvents);
        super.start();
    }

    @Override
    protected void append(ILoggingEvent event) {
        if (!checkEntryConditions()) {
            return;
        }
        boolean accepted;
        try {
            accepted = eventEvaluator.evaluate(event);
        } catch (EvaluationException e) {
            addError("Evaluator failed for appender [" + getName() + "]", e);
            return;
        }
        if (!accepted) {
            return;
        }
        event.prepareForDeferredProcessing(); // capture MDC and thread before leaving this thread
        synchronized (this) {
            if (pending.length() >= maxEvents) {
                dropped++;
            }
            pending.add(event);
            if (scheduledFlush == null || scheduledFlush.isDone()) {
                scheduledFlush = context.getScheduledExecutorService()
                        .schedule(this::flush, interval.getMilliseconds(), TimeUnit.MILLISECONDS);
            }
        }
    }

    private void flush() {
        CyclicBuffer<ILoggingEvent> batch;
        ILoggingEvent last;
        int droppedNow;
        synchronized (this) {
            if (pending.length() == 0) {
                return;
            }
            batch = new CyclicBuffer<>(pending);
            last = pending.get(pending.length() - 1);
            droppedNow = dropped;
            pending.clear();
            dropped = 0;
        }
        if (droppedNow > 0) {
            addWarn(droppedNow + " error events were dropped from the mail digest (maxEvents=" + maxEvents + ")");
        }
        sendBuffer(batch, last);
    }

    @Override
    public void stop() {
        ScheduledFuture<?> future;
        synchronized (this) {
            future = scheduledFlush;
        }
        if (future != null) {
            future.cancel(false);
        }
        try {
            flush(); // best effort: do not lose errors logged just before shutdown
        } catch (RuntimeException e) {
            addWarn("Could not send final digest", e);
        }
        super.stop();
    }
}
