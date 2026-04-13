using ElectionAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace ElectionAPI.Data
{
    public class ElectionDbContext : DbContext
    {
        public ElectionDbContext(DbContextOptions<ElectionDbContext> options)
            : base(options) { }

        public DbSet<ElectionWB2026> ElectionWB2026 => Set<ElectionWB2026>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<ElectionWB2026>(e =>
            {
                e.ToTable("Election_WB_2026");

                // Composite PK — both nullable in DB but used as key
                e.HasKey(x => new { x.ConstituencyId, x.Rank });

                // Column mappings
                e.Property(x => x.ConstituencyId)      .HasColumnName("CONSTITUENCY_ID");
                e.Property(x => x.ConstituencyName)    .HasColumnName("CONSTITUENCY_NAME");
                e.Property(x => x.ConstituencyBengali) .HasColumnName("CONSTITUENCY_BENGALI");
                e.Property(x => x.Rank)                .HasColumnName("RANK");
                e.Property(x => x.CandidateName)       .HasColumnName("CANDIDATE_NAME");
                e.Property(x => x.CandidateNameBengali).HasColumnName("CANDIDATE_NAME_BENGALI");
                e.Property(x => x.Gender)              .HasColumnName("GENDER");
                e.Property(x => x.Age)                 .HasColumnName("AGE");
                e.Property(x => x.Category)            .HasColumnName("CATEGORY");
                e.Property(x => x.PartyName)           .HasColumnName("PARTY_NAME");
                e.Property(x => x.VotesGeneral)        .HasColumnName("VOTES_GENERAL");
                e.Property(x => x.VotesPostal)         .HasColumnName("VOTES_POSTAL");
                e.Property(x => x.VotesTotal)          .HasColumnName("VOTES_TOTAL");
                e.Property(x => x.TotalElectors)       .HasColumnName("TOTAL_ELECTORS");
                e.Property(x => x.VotePercentage)
                 .HasColumnName("VOTE_PERCENTAGE")
                 .HasColumnType("float");

                // The 16th unnamed float column in the schema — ignore it
                e.Ignore("Column16");
            });
        }
    }
}
