using FastEndpoints;
using FluentValidation;

namespace BookIt.Api.Features.Reservation;

public record ReservationRequest(string UserId, DateTime StartDate, DateTime EndDate, string CourtId);
public record ReservationResponse(string Id, DateTime StartDate, DateTime EndDate, string CourtId);

public class ReservationValidator : Validator<ReservationRequest>
{
    public ReservationValidator()
    {
        RuleFor(x => x.StartDate)
            .NotEmpty()
            .WithMessage("StartDate is required!");
    }
}

public class ReservationEndpoint : Endpoint<ReservationRequest, ReservationResponse>
{
    public override void Configure()
    {
        Post("/reservations");
        Policies("Member");
        Description(x => x
            .WithName("CreateReservation")
            .Produces<ReservationResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest));
    }

    public override async Task HandleAsync(ReservationRequest req, CancellationToken ct)
    {
        var response = new ReservationResponse(
            Id: Guid.NewGuid().ToString(),
            StartDate: req.StartDate,
            EndDate: req.EndDate,
            CourtId: req.CourtId);

        //await Send.CreatedAtAsync(response, cancellation: ct);
    }
}
