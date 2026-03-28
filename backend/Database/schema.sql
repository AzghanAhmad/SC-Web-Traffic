CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
    `MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK___EFMigrationsHistory` PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

START TRANSACTION;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    ALTER DATABASE CHARACTER SET utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `AppUsersSet` (
        `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Email` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `PasswordHash` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `Role` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_AppUsersSet` PRIMARY KEY (`UserId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `ConversionsSet` (
        `ConversionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SiteId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SessionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Type` int NOT NULL,
        `Value` decimal(65,30) NULL,
        `Timestamp` datetime(6) NOT NULL,
        CONSTRAINT `PK_ConversionsSet` PRIMARY KEY (`ConversionId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `DailySnapshotsSet` (
        `SnapshotId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SiteId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Date` date NOT NULL,
        `TotalVisitors` int NOT NULL,
        `Sessions` int NOT NULL,
        `PageViews` int NOT NULL,
        `Conversions` int NOT NULL,
        `TopSource` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `TopPage` varchar(1024) CHARACTER SET utf8mb4 NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_DailySnapshotsSet` PRIMARY KEY (`SnapshotId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `Events` (
        `EventId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SiteId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SessionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `VisitorId` char(36) COLLATE ascii_general_ci NOT NULL,
        `EventType` int NOT NULL,
        `EventName` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `PageUrl` varchar(1024) CHARACTER SET utf8mb4 NOT NULL,
        `Metadata` json NOT NULL,
        `Timestamp` datetime(6) NOT NULL,
        CONSTRAINT `PK_Events` PRIMARY KEY (`EventId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `HeatmapDataSet` (
        `HeatmapId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SiteId` char(36) COLLATE ascii_general_ci NOT NULL,
        `PageUrl` varchar(1024) CHARACTER SET utf8mb4 NOT NULL,
        `X` int NOT NULL,
        `Y` int NOT NULL,
        `ScrollDepth` int NOT NULL,
        `DeviceType` int NOT NULL,
        `Timestamp` datetime(6) NOT NULL,
        CONSTRAINT `PK_HeatmapDataSet` PRIMARY KEY (`HeatmapId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `PageViewsSet` (
        `PageViewId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SiteId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SessionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `PageUrl` varchar(1024) CHARACTER SET utf8mb4 NOT NULL,
        `TimeOnPage` double NOT NULL,
        `Timestamp` datetime(6) NOT NULL,
        CONSTRAINT `PK_PageViewsSet` PRIMARY KEY (`PageViewId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `SessionsSet` (
        `SessionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SiteId` char(36) COLLATE ascii_general_ci NOT NULL,
        `VisitorId` char(36) COLLATE ascii_general_ci NOT NULL,
        `StartedAt` datetime(6) NOT NULL,
        `EndedAt` datetime(6) NULL,
        `DeviceType` int NOT NULL,
        `Country` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Referrer` varchar(512) CHARACTER SET utf8mb4 NOT NULL,
        `Source` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `Medium` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `Campaign` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `LastActivityAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_SessionsSet` PRIMARY KEY (`SessionId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `SitesSet` (
        `SiteId` char(36) COLLATE ascii_general_ci NOT NULL,
        `UserId` varchar(128) CHARACTER SET utf8mb4 NOT NULL,
        `Name` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
        `Domain` varchar(256) CHARACTER SET utf8mb4 NOT NULL,
        `Platform` int NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_SitesSet` PRIMARY KEY (`SiteId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE TABLE `VisitorsSet` (
        `VisitorId` char(36) COLLATE ascii_general_ci NOT NULL,
        `SiteId` char(36) COLLATE ascii_general_ci NOT NULL,
        `AnonymousId` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `FirstSeenAt` datetime(6) NOT NULL,
        `LastSeenAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_VisitorsSet` PRIMARY KEY (`VisitorId`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE INDEX `IX_ConversionsSet_SiteId_Timestamp` ON `ConversionsSet` (`SiteId`, `Timestamp`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE UNIQUE INDEX `IX_DailySnapshotsSet_SiteId_Date` ON `DailySnapshotsSet` (`SiteId`, `Date`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE INDEX `IX_Events_SessionId` ON `Events` (`SessionId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE INDEX `IX_Events_SiteId_Timestamp` ON `Events` (`SiteId`, `Timestamp`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE INDEX `IX_HeatmapDataSet_SiteId_Timestamp` ON `HeatmapDataSet` (`SiteId`, `Timestamp`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE INDEX `IX_PageViewsSet_SessionId` ON `PageViewsSet` (`SessionId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE INDEX `IX_PageViewsSet_SiteId_Timestamp` ON `PageViewsSet` (`SiteId`, `Timestamp`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE INDEX `IX_SessionsSet_LastActivityAt` ON `SessionsSet` (`LastActivityAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    CREATE INDEX `IX_SessionsSet_SiteId_StartedAt` ON `SessionsSet` (`SiteId`, `StartedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260326192033_InitialCreate') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260326192033_InitialCreate', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

COMMIT;

