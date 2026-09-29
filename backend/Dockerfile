# Sjodur backend – build from the repository root, because the message catalogs come from frontend/locales:
#   docker build -f backend/Dockerfile -t sjodur-backend .
# syntax=docker/dockerfile:1.7

# ---- build ---------------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
# Gradle wrapper and build files first, so dependency resolution is cached between builds
COPY backend/gradlew backend/gradlew
COPY backend/gradle backend/gradle
COPY backend/build.gradle backend/settings.gradle backend/
RUN --mount=type=cache,target=/root/.gradle cd backend && ./gradlew --no-daemon dependencies > /dev/null || true
# sources and the shared catalogs
COPY backend/src backend/src
COPY frontend/locales frontend/locales
RUN --mount=type=cache,target=/root/.gradle cd backend && ./gradlew --no-daemon bootJar -x test
# split the jar into layers (dependencies change rarely, application code often)
RUN cd backend/build/libs && java -Djarmode=tools -jar *.jar extract --layers --destination /extracted

# ---- runtime -------------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime
RUN addgroup -S sjodur && adduser -S -G sjodur sjodur
WORKDIR /app
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./
USER sjodur
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
  CMD wget -qO- http://127.0.0.1:8080/actuator/health/readiness || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
