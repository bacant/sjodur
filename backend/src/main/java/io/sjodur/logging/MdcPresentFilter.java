package io.sjodur.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.filter.Filter;
import ch.qos.logback.core.spi.FilterReply;

/**
 * Lets an event pass only if the given MDC key is set. Used on the SiftingAppender so that
 * only jobs which asked for their own log file (LogContext.file) end up in one.
 */
public class MdcPresentFilter extends Filter<ILoggingEvent> {

    private String key;

    public void setKey(String key) {
        this.key = key;
    }

    @Override
    public void start() {
        if (key == null || key.isBlank()) {
            addError("MdcPresentFilter needs a <key>");
            return;
        }
        super.start();
    }

    @Override
    public FilterReply decide(ILoggingEvent event) {
        if (!isStarted()) {
            return FilterReply.NEUTRAL;
        }
        String value = event.getMDCPropertyMap().get(key);
        return value == null || value.isBlank() ? FilterReply.DENY : FilterReply.NEUTRAL;
    }
}
