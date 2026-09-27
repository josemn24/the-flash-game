import type { HTMLAttributes, ReactNode } from "react";
import { Canvas, Card } from "@/components/ui";
import styles from "./LoadingSkeleton.module.css";

function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export type SkeletonBlockProps = HTMLAttributes<HTMLSpanElement>;

export function SkeletonBlock({ className, ...props }: SkeletonBlockProps) {
  return <span {...props} aria-hidden="true" className={cx(styles.skeleton, className)} />;
}

function LoadingShell({
  children,
  contentClassName,
  maxWidth = "content",
}: {
  children: ReactNode;
  contentClassName?: string;
  maxWidth?: "wide" | "content" | "none";
}) {
  return (
    <Canvas aria-busy="true" contentClassName={contentClassName} maxWidth={maxWidth}>
      <div className={styles.status} role="status" aria-live="polite">
        <span className={styles.visuallyHidden}>Cargando…</span>
        {children}
      </div>
    </Canvas>
  );
}

export function GlobalLoading() {
  return (
    <LoadingShell maxWidth="none" contentClassName={styles.globalContent}>
      <div className={styles.globalLoading} aria-hidden="true">
        <SkeletonBlock className={styles.globalMark} />
        <SkeletonBlock className={styles.globalLabel} />
      </div>
    </LoadingShell>
  );
}

export function RoomToolbarSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <div className={cx(styles.toolbar, detail && styles.detailToolbar)} aria-hidden="true">
      <SkeletonBlock className={styles.toolbarIcon} />
      {detail ? (
        <div className={styles.toolbarCenter}>
          <SkeletonBlock className={styles.toolbarPill} />
        </div>
      ) : null}
      <SkeletonBlock className={cx(styles.toolbarIcon, !detail && styles.toolbarSpacer)} />
    </div>
  );
}

function LeaderboardRows({ cards = false, rows = 5 }: { cards?: boolean; rows?: number }) {
  return (
    <div className={cx(styles.leaderboardRows, cards && styles.leaderboardCards)}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={cx(styles.leaderboardRow, cards && styles.leaderboardCardRow)} key={index}>
          <SkeletonBlock className={cx(styles.rank, cards && styles.cardRank)} />
          <SkeletonBlock className={cx(styles.avatar, cards && styles.avatarMedium)} />
          <span className={styles.playerName}>
            <SkeletonBlock className={cx(styles.nameLine, cards && styles.cardNameLine)} />
            {!cards ? <SkeletonBlock className={styles.nameMeta} /> : null}
          </span>
          <SkeletonBlock className={cx(styles.points, cards && styles.cardPoints)} />
          {cards ? <SkeletonBlock className={styles.cardArrow} /> : null}
        </div>
      ))}
    </div>
  );
}

function LeaderboardSkeleton({
  cards = false,
  rows = 5,
  surface = false,
}: {
  cards?: boolean;
  rows?: number;
  surface?: boolean;
}) {
  const content = (
    <>
      <div className={styles.leaderboardHeading} aria-hidden="true">
        <SkeletonBlock className={styles.leaderboardTitle} />
        <SkeletonBlock className={styles.leaderboardIcon} />
      </div>
      <LeaderboardRows cards={cards} rows={rows} />
    </>
  );

  return surface ? (
    <Card as="section" padding="default" className={styles.leaderboardSurface}>
      {content}
    </Card>
  ) : (
    <section className={styles.leaderboardSection}>{content}</section>
  );
}

export function RoomCollectionSkeleton() {
  return (
    <LoadingShell contentClassName={styles.collectionContent}>
      <div className={styles.collectionLayout} aria-hidden="true">
        <div className={styles.collectionToolbar}>
          <SkeletonBlock className={styles.collectionBrand} />
          <SkeletonBlock className={styles.collectionAction} />
        </div>
        <div className={styles.collectionHeading}>
          <SkeletonBlock className={styles.collectionEyebrow} />
          <SkeletonBlock className={styles.collectionTitle} />
        </div>
        <div className={styles.collectionGrid}>
          {Array.from({ length: 3 }, (_, index) => (
            <Card as="article" padding="none" className={styles.collectionCard} key={index}>
              <SkeletonBlock className={styles.collectionCardArt} />
              <div className={styles.collectionCardBody}>
                <SkeletonBlock className={styles.collectionCardTitle} />
                <SkeletonBlock className={styles.collectionCardMeta} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

export function RoomDetailSkeleton() {
  return (
    <LoadingShell contentClassName={styles.detailContent}>
      <div className={styles.detailLayout} aria-hidden="true">
        <RoomToolbarSkeleton detail />
        <SkeletonBlock className={styles.statPill} />
        <div className={styles.detailMain}>
          <SkeletonBlock className={styles.todayLabel} />
          <Card as="section" elevation="hero" padding="none" className={styles.challengeCard}>
            <SkeletonBlock className={styles.challengeArt} />
            <div className={styles.challengeFooter}>
              <SkeletonBlock className={styles.challengeFormat} />
              <SkeletonBlock className={styles.challengeAction} />
            </div>
          </Card>
          <LeaderboardSkeleton cards rows={4} surface />
        </div>
      </div>
    </LoadingShell>
  );
}

export function RoomRankingSkeleton() {
  return (
    <LoadingShell contentClassName={styles.secondaryContent}>
      <div className={styles.secondaryLayout} aria-hidden="true">
        <RoomToolbarSkeleton />
        <div className={styles.pageIntro}>
          <SkeletonBlock className={styles.pageEyebrow} />
          <SkeletonBlock className={styles.pageTitle} />
        </div>
        <LeaderboardSkeleton rows={7} />
      </div>
    </LoadingShell>
  );
}

export function RoomHistorySkeleton() {
  return (
    <LoadingShell contentClassName={styles.secondaryContent}>
      <div className={styles.secondaryLayout} aria-hidden="true">
        <RoomToolbarSkeleton />
        <div className={styles.pageIntro}>
          <SkeletonBlock className={styles.pageEyebrow} />
          <SkeletonBlock className={styles.pageTitle} />
        </div>
        <div className={styles.historyList}>
          {Array.from({ length: 3 }, (_, index) => (
            <Card as="article" padding="none" className={styles.historyCard} key={index}>
              <SkeletonBlock className={styles.historyArt} />
              <div className={styles.historyBody}>
                <SkeletonBlock className={styles.historyTitle} />
                <SkeletonBlock className={styles.historyWinner} />
                <SkeletonBlock className={styles.historyAction} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

export function RoomHistoryDetailSkeleton() {
  return (
    <LoadingShell contentClassName={styles.secondaryContent}>
      <div className={styles.secondaryLayout} aria-hidden="true">
        <RoomToolbarSkeleton />
        <div className={styles.pageIntro}>
          <SkeletonBlock className={styles.pageEyebrow} />
          <SkeletonBlock className={styles.detailPageTitle} />
          <div className={styles.badges}>
            <SkeletonBlock className={styles.badge} />
            <SkeletonBlock className={styles.badge} />
          </div>
        </div>
        <LeaderboardSkeleton rows={6} />
      </div>
    </LoadingShell>
  );
}

export function RoomMemberDetailSkeleton() {
  return (
    <LoadingShell contentClassName={styles.memberContent}>
      <div className={styles.memberLayout} aria-hidden="true">
        <RoomToolbarSkeleton />
        <div className={styles.memberProfile}>
          <SkeletonBlock className={styles.avatarLarge} />
          <div className={styles.memberProfileText}>
            <SkeletonBlock className={styles.pageEyebrow} />
            <SkeletonBlock className={styles.memberTitle} />
            <SkeletonBlock className={styles.memberMeta} />
          </div>
        </div>
        <Card as="section" className={styles.memberSummary}>
          <div className={styles.memberSummaryHeading}>
            <SkeletonBlock className={styles.summaryEyebrow} />
            <SkeletonBlock className={styles.summaryTitle} />
          </div>
          <div className={styles.memberStats}>
            {Array.from({ length: 3 }, (_, index) => (
              <div className={styles.memberStat} key={index}>
                <SkeletonBlock className={styles.memberStatValue} />
                <SkeletonBlock className={styles.memberStatLabel} />
              </div>
            ))}
          </div>
        </Card>
        <div className={styles.answerHistory}>
          <SkeletonBlock className={styles.memberSectionTitle} />
          <div className={styles.answerRows}>
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonBlock className={styles.answerRow} key={index} />
            ))}
          </div>
        </div>
      </div>
    </LoadingShell>
  );
}

export function RoomSettingsSkeleton() {
  return (
    <LoadingShell maxWidth="none" contentClassName={styles.settingsContent}>
      <div className={styles.settingsLayout} aria-hidden="true">
        <section className={styles.settingsHero}>
          <div className={styles.settingsToolbar}>
            <SkeletonBlock className={styles.toolbarIcon} />
            <SkeletonBlock className={styles.settingsAction} />
          </div>
          <div className={styles.settingsHeroContent}>
            <div className={styles.settingsAvatars}>
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonBlock className={styles.avatarMedium} key={index} />
              ))}
            </div>
            <SkeletonBlock className={styles.settingsCount} />
            <SkeletonBlock className={styles.settingsTitle} />
          </div>
        </section>
        <section className={styles.settingsBody}>
          <div className={styles.settingsHeading}>
            <SkeletonBlock className={styles.settingsSectionTitle} />
            <SkeletonBlock className={styles.settingsSectionCount} />
          </div>
          <div className={styles.memberRows}>
            {Array.from({ length: 5 }, (_, index) => (
              <div className={styles.memberRow} key={index}>
                <SkeletonBlock className={styles.avatarSmall} />
                <SkeletonBlock className={styles.memberRowName} />
                <SkeletonBlock className={styles.memberRowMeta} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </LoadingShell>
  );
}
