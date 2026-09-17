/*
  Analytics layer for the Payables Pulse semantic model.

  The Rayfin-managed operational tables have no date-only keys, so a reporting
  star schema is derived from them here. Nothing in this script alters a
  Rayfin-managed table — it only adds dbo.DimDate, dbo.FactPayment,
  dbo.FactException and the procedure that rebuilds the two facts.
*/

IF OBJECT_ID('dbo.FactPayment', 'U') IS NOT NULL DROP TABLE dbo.FactPayment;
IF OBJECT_ID('dbo.FactException', 'U') IS NOT NULL DROP TABLE dbo.FactException;
IF OBJECT_ID('dbo.DimDate', 'U') IS NOT NULL DROP TABLE dbo.DimDate;
GO

CREATE TABLE dbo.DimDate (
    [Date]          DATE         NOT NULL PRIMARY KEY NONCLUSTERED,
    [DateKey]       INT          NOT NULL,
    [Year]          INT          NOT NULL,
    [Quarter]       INT          NOT NULL,
    [QuarterName]   NVARCHAR(8)  NOT NULL,
    [MonthNumber]   INT          NOT NULL,
    [MonthName]     NVARCHAR(16) NOT NULL,
    [MonthShort]    NVARCHAR(4)  NOT NULL,
    [MonthYear]     NVARCHAR(16) NOT NULL,
    [YearMonthKey]  INT          NOT NULL,
    [WeekStartDate] DATE         NOT NULL,
    [DayOfMonth]    INT          NOT NULL,
    [DayName]       NVARCHAR(12) NOT NULL,
    [DayShort]      NVARCHAR(4)  NOT NULL,
    [IsWeekend]     BIT          NOT NULL
);
GO

CREATE TABLE dbo.FactPayment (
    [PaymentId]            UNIQUEIDENTIFIER NOT NULL PRIMARY KEY NONCLUSTERED,
    [PaymentReference]     NVARCHAR(30)     NOT NULL,
    [InitiatedDate]        DATE             NOT NULL,
    [SettledDate]          DATE             NULL,
    [CustomerId]           UNIQUEIDENTIFIER NULL,
    [VendorId]             UNIQUEIDENTIFIER NULL,
    [InvoiceId]            UNIQUEIDENTIFIER NULL,
    [PaymentMethod]        NVARCHAR(20)     NOT NULL,
    [PaymentMethodLabel]   NVARCHAR(20)     NOT NULL,
    [Status]               NVARCHAR(20)     NOT NULL,
    [Country]              NVARCHAR(60)     NOT NULL,
    [Currency]             NVARCHAR(3)      NOT NULL,
    [Corridor]             NVARCHAR(16)     NOT NULL,
    [Amount]               DECIMAL(18, 2)   NOT NULL,
    [AmountUsd]            DECIMAL(18, 2)   NOT NULL,
    [RebateAmount]         DECIMAL(18, 2)   NOT NULL,
    [RebateOpportunityUsd] DECIMAL(18, 2)   NOT NULL,
    [ProcessingHours]      DECIMAL(8, 2)    NOT NULL,
    [ApprovalHours]        DECIMAL(8, 2)    NULL,
    [AttemptCount]         INT              NOT NULL,
    [IsCrossBorder]        BIT              NOT NULL,
    [IsStraightThrough]    BIT              NOT NULL,
    [IsSuccessful]         BIT              NOT NULL,
    [IsFailed]             BIT              NOT NULL,
    [IsRebateEligible]     BIT              NOT NULL
);
GO

CREATE TABLE dbo.FactException (
    [ExceptionId]          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY NONCLUSTERED,
    [ExceptionCode]        NVARCHAR(20)     NOT NULL,
    [CreatedDate]          DATE             NOT NULL,
    [ResolvedDate]         DATE             NULL,
    [SlaDueDate]           DATE             NOT NULL,
    [CustomerId]           UNIQUEIDENTIFIER NULL,
    [VendorId]             UNIQUEIDENTIFIER NULL,
    [AssignedToId]         UNIQUEIDENTIFIER NULL,
    [ResolutionCategoryId] UNIQUEIDENTIFIER NULL,
    [ExceptionType]        NVARCHAR(40)     NOT NULL,
    [Priority]             NVARCHAR(12)     NOT NULL,
    [PriorityRank]         INT              NOT NULL,
    [Status]               NVARCHAR(24)     NOT NULL,
    [SlaRisk]              NVARCHAR(12)     NOT NULL,
    [PaymentMethod]        NVARCHAR(20)     NOT NULL,
    [Country]              NVARCHAR(60)     NOT NULL,
    [AmountUsd]            DECIMAL(18, 2)   NOT NULL,
    [SlaTargetHours]       INT              NOT NULL,
    [ResolutionHours]      DECIMAL(10, 2)   NULL,
    [AgeHours]             DECIMAL(10, 2)   NOT NULL,
    [RetryCount]           INT              NOT NULL,
    [ReopenCount]          INT              NOT NULL,
    [IsOpen]               BIT              NOT NULL,
    [IsResolved]           BIT              NOT NULL,
    [IsHighPriority]       BIT              NOT NULL,
    [IsBreached]           BIT              NOT NULL,
    [IsEscalated]          BIT              NOT NULL,
    [IsCrossBorder]        BIT              NOT NULL
);
GO

/* DimDate covers two full years around the demo horizon. */
WITH n AS (
    SELECT TOP (731) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS i
    FROM sys.all_objects a CROSS JOIN sys.all_objects b
),
d AS (SELECT DATEADD(DAY, i, CAST('2026-01-01' AS DATE)) AS [Date] FROM n)
INSERT INTO dbo.DimDate
SELECT
    [Date],
    (YEAR([Date]) * 10000) + (MONTH([Date]) * 100) + DAY([Date]),
    YEAR([Date]),
    DATEPART(QUARTER, [Date]),
    CONCAT('Q', DATEPART(QUARTER, [Date]), ' ', YEAR([Date])),
    MONTH([Date]),
    DATENAME(MONTH, [Date]),
    LEFT(DATENAME(MONTH, [Date]), 3),
    CONCAT(LEFT(DATENAME(MONTH, [Date]), 3), ' ', YEAR([Date])),
    (YEAR([Date]) * 100) + MONTH([Date]),
    DATEADD(DAY, -(DATEPART(WEEKDAY, [Date]) - 1), [Date]),
    DAY([Date]),
    DATENAME(WEEKDAY, [Date]),
    LEFT(DATENAME(WEEKDAY, [Date]), 3),
    CASE WHEN DATEPART(WEEKDAY, [Date]) IN (1, 7) THEN 1 ELSE 0 END
FROM d;
GO

CREATE OR ALTER PROCEDURE dbo.usp_RefreshPayablesAnalytics
AS
BEGIN
    SET NOCOUNT ON;

    TRUNCATE TABLE dbo.FactPayment;
    TRUNCATE TABLE dbo.FactException;

    INSERT INTO dbo.FactPayment
    SELECT
        p.id,
        p.paymentReference,
        CAST(p.initiatedAt AS DATE),
        CAST(p.settledAt AS DATE),
        p.customer_id,
        p.vendor_id,
        p.invoice_id,
        p.paymentMethod,
        CASE p.paymentMethod
            WHEN 'ach' THEN 'ACH'
            WHEN 'check' THEN 'Check'
            WHEN 'virtual-card' THEN 'Virtual card'
            WHEN 'wire' THEN 'Wire'
            WHEN 'cross-border' THEN 'Cross-border'
            ELSE p.paymentMethod
        END,
        p.status,
        p.country,
        p.currency,
        CASE WHEN p.isCrossBorder = 1 THEN 'Cross-border' ELSE 'Domestic' END,
        p.amount,
        p.amountUsd,
        p.rebateAmount,
        CASE
            WHEN p.rebateEligible = 0 AND p.amountUsd < 100000
                THEN CAST(p.amountUsd * 0.0135 AS DECIMAL(18, 2))
            ELSE 0
        END,
        p.processingHours,
        i.approvalHours,
        p.attemptCount,
        p.isCrossBorder,
        p.straightThrough,
        CASE WHEN p.status IN ('settled', 'processing') THEN 1 ELSE 0 END,
        CASE WHEN p.status IN ('failed', 'returned') THEN 1 ELSE 0 END,
        p.rebateEligible
    FROM dbo.Payments p
    LEFT JOIN dbo.Invoices i ON i.id = p.invoice_id;

    INSERT INTO dbo.FactException
    SELECT
        e.id,
        e.exceptionCode,
        CAST(e.createdAt AS DATE),
        CAST(e.resolvedAt AS DATE),
        CAST(e.slaDueAt AS DATE),
        e.customer_id,
        e.vendor_id,
        e.assignedTo_id,
        e.resolutionCategory_id,
        e.exceptionType,
        e.priority,
        CASE e.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
        END,
        e.status,
        e.slaRisk,
        e.paymentMethod,
        e.country,
        e.amountUsd,
        e.slaTargetHours,
        CASE
            WHEN e.resolvedAt IS NULL THEN NULL
            ELSE CAST(DATEDIFF(MINUTE, e.createdAt, e.resolvedAt) / 60.0 AS DECIMAL(10, 2))
        END,
        CAST(
            DATEDIFF(MINUTE, e.createdAt, COALESCE(e.resolvedAt, SYSUTCDATETIME())) / 60.0
            AS DECIMAL(10, 2)
        ),
        e.retryCount,
        e.reopenCount,
        CASE WHEN e.status IN ('resolved', 'closed') THEN 0 ELSE 1 END,
        CASE WHEN e.resolvedAt IS NULL THEN 0 ELSE 1 END,
        CASE WHEN e.priority IN ('critical', 'high') THEN 1 ELSE 0 END,
        CASE WHEN e.slaRisk = 'breached' THEN 1 ELSE 0 END,
        e.escalated,
        e.isCrossBorder
    FROM dbo.PaymentExceptions e;
END;
GO

EXEC dbo.usp_RefreshPayablesAnalytics;
GO
